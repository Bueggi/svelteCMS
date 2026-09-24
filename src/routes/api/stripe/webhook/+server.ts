import { json, error } from '@sveltejs/kit';
import type Stripe from 'stripe';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey, getWebhookSecret } from '$lib/server/settings';
import { db } from '$lib/server/db';
import { enrollments, purchases, user, courses } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { sendMail } from '$lib/server/email/mailer';
import { enrollmentConfirmEmail, enrollmentRevokedEmail, paymentFailedEmail } from '$lib/server/email/templates';
import { fireAutomations } from '$lib/server/automations';
import {
    issueInvoice, issueCorrection, sendInvoiceEmail, customerFromCheckout, findInvoiceByPaymentReference,
} from '$lib/server/invoices';
import { getTaxContext } from '$lib/server/settings';
import { determineTax, type TaxTreatment } from '$lib/tax';
import {
    purchasesForOrder, targetsFromPurchases, revokeCourseAccess, restoreDisputedAccess,
    type AccessTarget, type RevokeReason,
} from '$lib/server/payment-events';
import { auth } from '$lib/server/auth';
import { env } from '$env/dynamic/private';

// ── Helpers ─────────────────────────────────────────────────────────────────
// Webhook payloads use the endpoint's API version, which may be newer than the client's
// pinned one, so read fields that moved between versions defensively.

const idOf = (v: any): string | null => (!v ? null : typeof v === 'string' ? v : (v.id ?? null));

function invoiceSubscriptionId(inv: any): string | null {
    return idOf(inv?.subscription) ?? idOf(inv?.parent?.subscription_details?.subscription);
}

function periodEnd(sub: any): Date | undefined {
    const ts = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
    return ts ? new Date(ts * 1000) : undefined;
}

const isInstallmentPlan = (sub: any) => sub?.metadata?.paymentPlan === 'installments';

/**
 * Resolves which course accesses a payment paid for.
 * One-time orders → every course of the checkout session.
 * Subscriptions / installment plans → only the course the subscription is for.
 */
async function resolvePaymentTargets(stripe: Stripe, paymentIntentId: string) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId) as any;
    const invoiceId = idOf(pi.invoice);
    const subscriptionId = invoiceId ? invoiceSubscriptionId(await stripe.invoices.retrieve(invoiceId)) : null;

    if (!subscriptionId) {
        const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
        const rows = sessions.data[0] ? await purchasesForOrder(sessions.data[0].id) : [];
        return { subscriptionId: null, targets: targetsFromPurchases(rows) };
    }

    const sessions = await stripe.checkout.sessions.list({ subscription: subscriptionId, limit: 1 });
    const rows = sessions.data[0] ? await purchasesForOrder(sessions.data[0].id) : [];
    const linked = await db.query.enrollments.findMany({ where: eq(enrollments.stripeSubscriptionId, subscriptionId) });

    let targets: AccessTarget[] = linked.map(e => ({ userId: e.userId, courseId: e.courseId }));
    if (targets.length === 0) {
        // Completed installment plans no longer carry the subscription id — fall back to the order's main course
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const mainCourseId = sub.metadata?.courseId;
        targets = rows.filter(p => p.courseId === mainCourseId).map(p => ({ userId: p.userId, courseId: p.courseId }));
    }
    for (const t of targets) {
        t.purchaseId = rows.find(p => p.userId === t.userId && p.courseId === t.courseId)?.id;
    }
    return { subscriptionId, targets };
}

/** Cancels course access (and the Stripe subscription, if any) and notifies the buyer. */
async function revokeAccess(stripe: Stripe, opts: {
    targets: AccessTarget[];
    reason: RevokeReason;
    purchaseStatus: 'refunded' | 'disputed' | 'failed';
    subscriptionId?: string | null;
    refundedAmount?: number;
}) {
    const { subscriptionId, ...revokeOpts } = opts;
    await revokeCourseAccess(revokeOpts);

    if (subscriptionId) {
        try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            if (sub.status !== 'canceled') await stripe.subscriptions.cancel(subscriptionId);
        } catch (err) {
            console.error('Failed to cancel subscription after revoking access:', err);
        }
    }
}

/**
 * Recounts paid rates of an installment plan from Stripe (idempotent, unlike incrementing),
 * reactivates suspended access and ends the subscription once the last rate is paid.
 */
async function syncInstallments(stripe: Stripe, sub: Stripe.Subscription) {
    const total = parseInt(sub.metadata?.installmentCount ?? '', 10) || 0;
    const paidInvoices = await stripe.invoices.list({ subscription: sub.id, status: 'paid', limit: 100 });
    const paid = paidInvoices.data.length;
    const completed = total > 0 && paid >= total;

    await db.update(enrollments)
        .set(completed
            // Fully paid: access becomes permanent and is detached from the subscription,
            // so the cancellation below doesn't revoke it.
            ? { installmentsPaid: paid, status: 'active', stripeSubscriptionId: null, currentPeriodEnd: null, cancelAtPeriodEnd: false }
            : { installmentsPaid: paid, status: 'active', currentPeriodEnd: periodEnd(sub) })
        .where(and(
            eq(enrollments.stripeSubscriptionId, sub.id),
            inArray(enrollments.status, ['active', 'suspended']),
        ));

    if (completed && sub.status !== 'canceled') {
        await stripe.subscriptions.cancel(sub.id);
    }
    return { paid, total };
}

// ── Invoicing ───────────────────────────────────────────────────────────────
// One invoice per payment that actually arrived; its payment reference (PaymentIntent) is what
// links invoice, DATEV booking and the Stripe balance transaction.

/** Tax as determined at checkout (metadata), else recomputed from the customer's country. */
async function taxFromMetadata(metadata: any, customer: { address: { country?: string }; vatId?: string | null }) {
    if (metadata?.taxTreatment) {
        return { treatment: metadata.taxTreatment as TaxTreatment, rate: parseInt(metadata.taxRate ?? '0', 10) || 0 };
    }
    return determineTax(await getTaxContext(), {
        country: customer.address.country, vatId: customer.vatId, isBusiness: !!customer.vatId,
    });
}

/** Lines whose gross amounts add up to exactly what was paid (rounding/discount remainder as own line). */
function balanceLines(lines: { description: string; grossCents: number }[], paidCents: number) {
    const diff = paidCents - lines.reduce((s, l) => s + l.grossCents, 0);
    return diff === 0 ? lines : [...lines, { description: diff < 0 ? 'Rabatt' : 'Ausgleichsbetrag', grossCents: diff }];
}

/** Invoice for a one-time checkout (payment mode), issued once the money has arrived. */
async function invoiceOneTimeCheckout(stripe: Stripe, session: any) {
    if (!session.amount_total) return;
    const rows = await purchasesForOrder(session.id);
    const main = rows.find(p => p.stripeCheckoutSessionId === session.id);
    if (!main) throw new Error(`No purchase recorded for session ${session.id}`);

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    const lines = balanceLines(
        lineItems.data.map(li => ({ description: li.description ?? 'Kurs', grossCents: li.amount_total })),
        session.amount_total,
    );
    const customer = customerFromCheckout(session.metadata, session.customer_details ?? {});
    const tax = await taxFromMetadata(session.metadata, customer);

    const invoiceId = await issueInvoice({
        kind: 'invoice',
        type: 'one_time',
        userId: main.userId,
        purchaseId: main.id,
        customer,
        taxTreatment: tax.treatment,
        vatRate: tax.rate,
        lines,
        currency: session.currency ?? 'eur',
        paymentProvider: 'stripe',
        paymentReference: idOf(session.payment_intent) ?? session.id,
        orderReference: session.id,
        paidAt: new Date(),
    });
    await sendInvoiceEmail(invoiceId);
}

/** Resolves the platform user a subscription invoice belongs to. */
async function userForSubscription(subId: string, sub: any, stripeInvoice: any): Promise<string | null> {
    const enrollment = await db.query.enrollments.findFirst({ where: eq(enrollments.stripeSubscriptionId, subId) });
    if (enrollment) return enrollment.userId;
    if (sub.metadata?.userId) return sub.metadata.userId;
    const customerId = idOf(stripeInvoice.customer);
    const byCustomer = customerId ? await db.query.user.findFirst({ where: eq(user.stripeCustomerId, customerId) }) : null;
    if (byCustomer) return byCustomer.id;
    const email = stripeInvoice.customer_email;
    const byEmail = email ? await db.query.user.findFirst({ where: eq(user.email, email) }) : null;
    return byEmail?.id ?? null;
}

/** Invoice for a paid subscription / installment invoice (first one included). */
async function invoiceSubscriptionPayment(stripe: Stripe, stripeInvoiceId: string, sub: any, userId: string, label: string) {
    // Retrieve through the client for its pinned API shape (payment_intent, line discounts)
    const inv = await stripe.invoices.retrieve(stripeInvoiceId) as any;
    if (!inv.amount_paid) return;

    const course = sub.metadata?.courseId
        ? await db.query.courses.findFirst({ where: eq(courses.id, sub.metadata.courseId) })
        : null;
    const courseTitle = course?.title ?? 'Kurs';
    const lines = balanceLines(
        (inv.lines?.data ?? []).map((li: any) => ({
            description: li.price?.recurring || li.type === 'subscription' ? `${courseTitle} — ${label}` : (li.description ?? 'Kurs'),
            grossCents: (li.amount ?? 0) - (li.discount_amounts ?? []).reduce((s: number, d: any) => s + (d.amount ?? 0), 0),
        })),
        inv.amount_paid,
    );
    const customer = customerFromCheckout(sub.metadata, {
        name: inv.customer_name, email: inv.customer_email, address: inv.customer_address,
    });
    const tax = await taxFromMetadata(sub.metadata, customer);

    const invoiceId = await issueInvoice({
        kind: 'invoice',
        type: isInstallmentPlan(sub) ? 'installment' : 'subscription',
        userId,
        customer,
        taxTreatment: tax.treatment,
        vatRate: tax.rate,
        lines,
        currency: inv.currency ?? 'eur',
        paymentProvider: 'stripe',
        paymentReference: idOf(inv.payment_intent) ?? inv.id,
        orderReference: sub.id,
        paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000) : new Date(),
        serviceDate: inv.period_start ? new Date(inv.period_start * 1000) : undefined,
    });
    await sendInvoiceEmail(invoiceId);
}

/** One correction document per Stripe refund of a payment (partial refunds included). */
async function invoiceRefunds(stripe: Stripe, chargeId: string, paymentIntentId: string) {
    const original = await findInvoiceByPaymentReference(paymentIntentId);
    if (!original) {
        console.warn(`Refund on ${paymentIntentId} without an invoice — no correction issued`);
        return;
    }
    const refunds = await stripe.refunds.list({ charge: chargeId, limit: 100 });
    for (const r of refunds.data) {
        if (r.status !== 'succeeded' && r.status !== 'pending') continue;
        const correctionId = await issueCorrection({
            original,
            refundedGrossCents: r.amount,
            paymentReference: r.id,
            refundedAt: new Date(r.created * 1000),
        });
        await sendInvoiceEmail(correctionId);
    }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();

    const webhookSecret = await getWebhookSecret();
    const stripeKey = await getStripeKey();

    if (!signature || !webhookSecret || !stripeKey) {
        return error(400, 'Missing signature or secret');
    }

    const stripe = getStripeClient(stripeKey);

    let event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed.`, err.message);
        return error(400, 'Webhook Error');
    }

    // ── Purchase completed ──────────────────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        let userId = session.metadata?.userId;

        const courseIdsRaw = session.metadata?.courseIds || session.metadata?.courseId;
        const courseIds: string[] = courseIdsRaw
            ? courseIdsRaw.split(',').map((id: string) => id.trim()).filter(Boolean)
            : [];

        if (courseIds.length === 0) {
            console.error('No courseIds in session metadata', session.id);
            return json({ received: true });
        }

        const installmentsTotal = session.metadata?.paymentPlan === 'installments'
            ? parseInt(session.metadata?.installmentCount ?? '', 10) || null
            : null;

        // Handle Guest Checkout
        if (!userId) {
            const email = session.customer_details?.email;
            const name = session.customer_details?.name || 'Student';
            if (email) {
                try {
                    const existingUser = await db.query.user.findFirst({ where: eq(user.email, email) });
                    if (existingUser) {
                        userId = existingUser.id;
                    } else {
                        userId = crypto.randomUUID();
                        await db.insert(user).values({
                            id: userId, email, name,
                            emailVerified: false, role: 'student',
                            createdAt: new Date(), updatedAt: new Date(),
                        });
                        // Send password-setup email so the new user can log in
                        try {
                            const baseUrl = env.BETTER_AUTH_URL || 'http://localhost:5173';
                            await auth.api.requestPasswordReset({
                                body: { email, redirectTo: `${baseUrl}/reset-password` },
                            });
                        } catch (emailErr) {
                            console.error('Failed to send password setup email:', emailErr);
                        }
                    }
                } catch (err) {
                    console.error('Error handling guest user creation:', err);
                }
            }
        }

        if (userId) {
            const buyer = await db.query.user.findFirst({ where: eq(user.id, userId) });
            const totalAmount = session.amount_total || 0;
            const perCourseAmount = courseIds.length > 1 ? Math.floor(totalAmount / courseIds.length) : totalAmount;

            // Subscriptions / installment plans are bought for the main course (index 0);
            // order bumps in the same checkout are one-time line items and get permanent access.
            const subId = idOf(session.subscription);
            let subPeriodEnd: Date | undefined;
            if (subId) {
                try {
                    subPeriodEnd = periodEnd(await stripe.subscriptions.retrieve(subId));
                } catch { /* non-fatal */ }
            }

            for (let i = 0; i < courseIds.length; i++) {
                const courseId = courseIds[i];
                const amount = i === 0
                    ? totalAmount - perCourseAmount * (courseIds.length - 1)
                    : perCourseAmount;

                try {
                    const sessionId = i === 0 ? session.id : `${session.id}_${i}`;

                    const legalChecksRaw = session.metadata?.legalChecks || '';
                    const legalChecksJson = legalChecksRaw || null;

                    const [purchase] = await db.insert(purchases).values({
                        userId, courseId,
                        stripeCheckoutSessionId: sessionId,
                        amount, status: 'completed',
                        legalChecksJson,
                    }).onConflictDoNothing().returning({ id: purchases.id });

                    // Stripe may deliver an event more than once — the purchase row is our idempotency key
                    if (!purchase) continue;

                    const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });

                    const isMain = i === 0;
                    const enrollmentSubId = isMain ? subId : null;
                    const expiresAt = course?.accessType === 'duration' && course.accessDuration
                        ? new Date(Date.now() + course.accessDuration * 24 * 60 * 60 * 1000)
                        : null;
                    const enrollmentData = {
                        status: 'active' as const,
                        stripeSubscriptionId: enrollmentSubId,
                        currentPeriodEnd: enrollmentSubId ? subPeriodEnd : null,
                        cancelAtPeriodEnd: false,
                        expiresAt,
                        installmentsTotal: isMain ? installmentsTotal : null,
                        installmentsPaid: isMain && installmentsTotal ? 1 : 0,
                    };

                    await db.insert(enrollments).values({ userId, courseId, ...enrollmentData })
                        .onConflictDoUpdate({
                            target: [enrollments.userId, enrollments.courseId],
                            set: enrollmentData,
                        });

                    // Send enrollment confirmation email + fire automations
                    if (buyer && course) {
                        await sendMail({
                            to: buyer.email,
                            subject: `Kauf bestätigt: ${course.title}`,
                            html: enrollmentConfirmEmail({
                                name: buyer.name,
                                courseTitle: course.title,
                                courseSlug: course.slug,
                                amount,
                            }),
                        });
                        const eventData = {
                            user: { id: buyer.id, email: buyer.email, name: buyer.name, createdAt: buyer.createdAt?.toISOString() },
                            course: { id: course.id, title: course.title, slug: course.slug },
                            purchase: { id: sessionId, amount, createdAt: new Date().toISOString() },
                        };
                        fireAutomations('purchase.completed', eventData);
                        fireAutomations('enrollment.created', {
                            ...eventData,
                            enrollment: { id: `enr_${userId}_${courseId}`, enrolledAt: new Date().toISOString() },
                        });
                    }
                } catch (err) {
                    console.error(`Error processing course ${courseId}:`, err);
                }
            }

            if (session.customer && typeof session.customer === 'string') {
                await db.update(user)
                    .set({ stripeCustomerId: session.customer })
                    .where(eq(user.id, userId));
            }

            // One invoice for the whole order. Subscriptions are invoiced per paid Stripe invoice
            // (invoice.payment_succeeded); delayed methods like SEPA once the money has arrived.
            if (session.mode === 'payment' && session.payment_status === 'paid') {
                try {
                    await invoiceOneTimeCheckout(stripe, session);
                } catch (invoiceErr) {
                    console.error('Failed to create invoice:', invoiceErr);
                }
            }
        } else {
            console.error('Could not determine userId for purchase', session.id);
        }
    }

    // ── Delayed payment (e.g. SEPA) arrived → now the order is paid and invoiced ─
    if (event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object as any;
        if (session.mode === 'payment') {
            try {
                await invoiceOneTimeCheckout(stripe, session);
            } catch (err) {
                console.error('Failed to invoice async payment:', err);
                return error(500, 'Invoice failed'); // let Stripe retry (checkout.session.completed may still be pending)
            }
        }
    }

    // ── Delayed payment (e.g. SEPA) failed after checkout ─────────────────────
    if (event.type === 'checkout.session.async_payment_failed') {
        const session = event.data.object as any;
        try {
            const rows = await purchasesForOrder(session.id);
            await revokeAccess(stripe, {
                targets: targetsFromPurchases(rows),
                reason: 'payment_failed',
                purchaseStatus: 'failed',
                subscriptionId: idOf(session.subscription),
            });
        } catch (err) {
            console.error('Error processing async_payment_failed:', err);
        }
    }

    // ── Refund ──────────────────────────────────────────────────────────────────
    // Only full refunds revoke access; partial refunds (goodwill, one add-on) are left to the admin.
    if (event.type === 'charge.refunded') {
        const charge = event.data.object as any;
        const paymentIntentId = idOf(charge.payment_intent);
        if (paymentIntentId) {
            try {
                await invoiceRefunds(stripe, charge.id, paymentIntentId);
            } catch (err) {
                console.error('Failed to issue refund correction:', err);
            }
        }
        if (charge.refunded && paymentIntentId) {
            try {
                const { subscriptionId, targets } = await resolvePaymentTargets(stripe, paymentIntentId);
                await revokeAccess(stripe, {
                    targets, subscriptionId,
                    reason: 'refund',
                    purchaseStatus: 'refunded',
                    refundedAmount: charge.amount_refunded || 0,
                });
            } catch (err) {
                console.error('Error processing refund webhook:', err);
            }
        }
    }

    // ── Chargeback / payment disputed ──────────────────────────────────────────
    if (event.type === 'charge.dispute.created') {
        const dispute = event.data.object as any;
        try {
            let paymentIntentId = idOf(dispute.payment_intent);
            if (!paymentIntentId && dispute.charge) {
                paymentIntentId = idOf((await stripe.charges.retrieve(idOf(dispute.charge)!)).payment_intent);
            }
            if (paymentIntentId) {
                const { subscriptionId, targets } = await resolvePaymentTargets(stripe, paymentIntentId);
                await revokeAccess(stripe, { targets, subscriptionId, reason: 'dispute', purchaseStatus: 'disputed' });
            }
        } catch (err) {
            console.error('Error processing dispute webhook:', err);
        }
    }

    // ── Chargeback won → restore access ────────────────────────────────────────
    // Subscriptions/installment plans were cancelled when the dispute opened and stay ended.
    if (event.type === 'charge.dispute.closed') {
        const dispute = event.data.object as any;
        const paymentIntentId = idOf(dispute.payment_intent);
        if (dispute.status === 'won' && paymentIntentId) {
            try {
                const { subscriptionId, targets } = await resolvePaymentTargets(stripe, paymentIntentId);
                if (!subscriptionId) await restoreDisputedAccess(targets);
            } catch (err) {
                console.error('Error processing dispute.closed webhook:', err);
            }
        }
    }

    // ── Subscription / installment rate paid ───────────────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
        const stripeInvoice = event.data.object as any;
        const subId = invoiceSubscriptionId(stripeInvoice);
        if (subId) {
            try {
                const sub = await stripe.subscriptions.retrieve(subId);
                let label: string | undefined;

                if (isInstallmentPlan(sub)) {
                    const { paid, total } = await syncInstallments(stripe, sub);
                    label = `Rate ${paid}/${total}`;
                } else {
                    // Update period end and restore access that a failed payment had suspended
                    await db.update(enrollments)
                        .set({ currentPeriodEnd: periodEnd(sub), status: 'active' })
                        .where(and(
                            eq(enrollments.stripeSubscriptionId, subId),
                            inArray(enrollments.status, ['active', 'suspended']),
                        ));
                }

                const userId = await userForSubscription(subId, sub, stripeInvoice);
                if (!userId) {
                    // checkout.session.completed hasn't created the user yet — Stripe retries later
                    return error(503, 'User for subscription not known yet');
                }
                await invoiceSubscriptionPayment(stripe, stripeInvoice.id, sub, userId, label ?? 'Abo-Zahlung');
            } catch (err) {
                console.error('Failed to process invoice.payment_succeeded:', err);
                return error(500, 'Processing failed'); // retried by Stripe; invoicing is idempotent
            }
        }
    }

    // ── Subscription / installment rate failed → suspend access ────────────────
    // Stripe keeps retrying; a later success (invoice.payment_succeeded) restores access.
    if (event.type === 'invoice.payment_failed') {
        const stripeInvoice = event.data.object as any;
        const subId = invoiceSubscriptionId(stripeInvoice);
        if (subId) {
            try {
                const suspended = await db.update(enrollments)
                    .set({ status: 'suspended' })
                    .where(and(eq(enrollments.stripeSubscriptionId, subId), eq(enrollments.status, 'active')))
                    .returning({ userId: enrollments.userId, courseId: enrollments.courseId });

                const baseUrl = env.BETTER_AUTH_URL || 'http://localhost:5173';
                for (const s of suspended) {
                    const buyer = await db.query.user.findFirst({ where: eq(user.id, s.userId) });
                    const course = await db.query.courses.findFirst({ where: eq(courses.id, s.courseId) });
                    if (!buyer || !course) continue;
                    await sendMail({
                        to: buyer.email,
                        subject: `Zahlung fehlgeschlagen: ${course.title}`,
                        html: paymentFailedEmail({
                            name: buyer.name,
                            courseTitle: course.title,
                            manageUrl: stripeInvoice.hosted_invoice_url || `${baseUrl}/billing`,
                        }),
                    });
                }
            } catch (err) {
                console.error('Failed to suspend enrollment on invoice.payment_failed:', err);
            }
        }
    }

    // ── Subscription cancelled / ended ─────────────────────────────────────────
    // Completed installment plans were detached from the subscription beforehand, so
    // anything still linked here ended early (unpaid, cancelled) and loses access.
    if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as any;
        try {
            const ended = await db.update(enrollments)
                .set({ status: 'cancelled', cancelAtPeriodEnd: false })
                .where(and(
                    eq(enrollments.stripeSubscriptionId, sub.id),
                    inArray(enrollments.status, ['active', 'suspended']),
                ))
                .returning({ userId: enrollments.userId, courseId: enrollments.courseId });

            if (isInstallmentPlan(sub)) {
                for (const e of ended) {
                    const buyer = await db.query.user.findFirst({ where: eq(user.id, e.userId) });
                    const course = await db.query.courses.findFirst({ where: eq(courses.id, e.courseId) });
                    if (!buyer || !course) continue;
                    await sendMail({
                        to: buyer.email,
                        subject: `Kurszugang beendet: ${course.title}`,
                        html: enrollmentRevokedEmail({ name: buyer.name, courseTitle: course.title, reason: 'payment_failed' }),
                    });
                }
            }
        } catch (err) {
            console.error('Failed to cancel enrollment on subscription.deleted:', err);
        }
    }

    // ── Subscription updated (cancel_at_period_end toggled, status changes) ────
    if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object as any;
        try {
            await db.update(enrollments)
                .set({
                    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
                    ...(periodEnd(sub) ? { currentPeriodEnd: periodEnd(sub) } : {}),
                })
                .where(eq(enrollments.stripeSubscriptionId, sub.id));

            if (sub.status === 'past_due' || sub.status === 'unpaid') {
                await db.update(enrollments)
                    .set({ status: 'suspended' })
                    .where(and(eq(enrollments.stripeSubscriptionId, sub.id), eq(enrollments.status, 'active')));
            }
        } catch (err) {
            console.error('Failed to update enrollment on subscription.updated:', err);
        }
    }

    return json({ received: true });
};
