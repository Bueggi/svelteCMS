import { json, error } from '@sveltejs/kit';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey, getWebhookSecret } from '$lib/server/settings';
import { db } from '$lib/server/db';
import { enrollments, purchases, user, courses } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { sendMail } from '$lib/server/email/mailer';
import { enrollmentConfirmEmail, refundConfirmEmail } from '$lib/server/email/templates';
import { fireAutomations } from '$lib/server/automations';
import { createInvoiceFromCheckout, createInvoiceFromSubscriptionPayment, voidInvoicesForPurchase } from '$lib/server/invoices';
import { auth } from '$lib/server/auth';

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
                            await auth.api.forgetPassword({
                                body: { email, redirectTo: '/dashboard' },
                                headers: new Headers({ 'content-type': 'application/json' }),
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

                    // For subscriptions, store stripeSubscriptionId and period end
                    const subId = session.subscription
                        ? (typeof session.subscription === 'string' ? session.subscription : session.subscription.id)
                        : null;
                    let periodEnd: Date | undefined;
                    if (subId) {
                        try {
                            const sub = await stripe.subscriptions.retrieve(subId);
                            periodEnd = new Date(sub.current_period_end * 1000);
                        } catch { /* non-fatal */ }
                    }

                    await db.insert(enrollments).values({
                        userId, courseId, status: 'active',
                        stripeSubscriptionId: subId ?? undefined,
                        currentPeriodEnd: periodEnd,
                    }).onConflictDoUpdate({
                        target: [enrollments.userId, enrollments.courseId],
                        set: {
                            status: 'active',
                            stripeSubscriptionId: subId ?? undefined,
                            currentPeriodEnd: periodEnd,
                        },
                    });

                    // Send enrollment confirmation email + fire automations
                    const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
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

                    // ── Create invoice ──────────────────────────────────────
                    if (purchase?.id) {
                        try {
                            // Fetch Stripe invoice PDF URL if Stripe created one
                            let stripeInvoiceId: string | undefined;
                            let stripePdfUrl: string | undefined;
                            if (session.invoice && typeof session.invoice === 'string') {
                                const stripeInv = await stripe.invoices.retrieve(session.invoice);
                                stripeInvoiceId = stripeInv.id;
                                stripePdfUrl = stripeInv.invoice_pdf ?? undefined;
                            }
                            await createInvoiceFromCheckout({
                                purchaseId: purchase.id,
                                userId,
                                session,
                                courseTitle: course?.title ?? 'Kurs',
                                stripeInvoiceId,
                                stripePdfUrl,
                            });
                        } catch (invoiceErr) {
                            console.error('Failed to create invoice:', invoiceErr);
                            // Non-fatal — purchase still succeeds
                        }
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
        } else {
            console.error('Could not determine userId for purchase', session.id);
        }
    }

    // ── Refund / Charge reversed ────────────────────────────────────────────────
    if (event.type === 'charge.refunded') {
        const charge = event.data.object as any;
        const sessionId = charge.payment_intent
            ? (await stripe.paymentIntents.retrieve(charge.payment_intent as string))
                  .metadata?.checkoutSessionId
            : null;

        // Best-effort: find purchase by session ID and revoke enrollment
        if (charge.metadata?.courseId && charge.metadata?.userId) {
            const { courseId, userId } = charge.metadata;
            try {
                await db.update(enrollments)
                    .set({ status: 'cancelled' })
                    .where(eq(enrollments.userId, userId));

                const buyer = await db.query.user.findFirst({ where: eq(user.id, userId) });
                const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });

                if (buyer && course) {
                    await sendMail({
                        to: buyer.email,
                        subject: `Rückerstattung: ${course.title}`,
                        html: refundConfirmEmail({
                            name: buyer.name,
                            courseTitle: course.title,
                            amount: charge.amount_refunded || 0,
                        }),
                    });
                }
            } catch (err) {
                console.error('Error processing refund webhook:', err);
            }
        }
    }

    // ── Subscription / recurring invoice paid ──────────────────────────────────
    if (event.type === 'invoice.payment_succeeded') {
        const stripeInvoice = event.data.object as any;
        // Only handle renewal invoices (not the initial subscription_create)
        if (stripeInvoice.subscription && stripeInvoice.billing_reason !== 'subscription_create') {
            try {
                const customerId = stripeInvoice.customer;
                const buyer = customerId
                    ? await db.query.user.findFirst({ where: eq(user.stripeCustomerId, customerId) })
                    : null;

                if (buyer) {
                    // Update currentPeriodEnd on the enrollment
                    const sub = await stripe.subscriptions.retrieve(stripeInvoice.subscription as string);
                    const periodEnd = new Date(sub.current_period_end * 1000);
                    await db.update(enrollments)
                        .set({ currentPeriodEnd: periodEnd })
                        .where(eq(enrollments.stripeSubscriptionId, stripeInvoice.subscription as string));

                    const courseTitle = stripeInvoice.lines?.data?.[0]?.description ?? 'Abo-Zahlung';
                    await createInvoiceFromSubscriptionPayment({
                        userId: buyer.id,
                        stripeInvoice,
                        courseTitle,
                    });
                }
            } catch (err) {
                console.error('Failed to create subscription invoice:', err);
            }
        }
    }

    // ── Subscription cancelled / ended ─────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as any;
        try {
            await db.update(enrollments)
                .set({ status: 'cancelled', cancelAtPeriodEnd: false })
                .where(eq(enrollments.stripeSubscriptionId, sub.id));
        } catch (err) {
            console.error('Failed to cancel enrollment on subscription.deleted:', err);
        }
    }

    // ── Subscription updated (e.g. cancel_at_period_end toggled) ──────────────
    if (event.type === 'customer.subscription.updated') {
        const sub = event.data.object as any;
        try {
            await db.update(enrollments)
                .set({
                    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
                    currentPeriodEnd: new Date(sub.current_period_end * 1000),
                })
                .where(eq(enrollments.stripeSubscriptionId, sub.id));
        } catch (err) {
            console.error('Failed to update enrollment on subscription.updated:', err);
        }
    }

    return json({ received: true });
};
