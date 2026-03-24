import { db } from '$lib/server/db';
import { purchases, enrollments } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, fail, type Actions } from '@sveltejs/kit';
import { stripe } from '$lib/server/stripe';
import type { PageServerLoad } from './$types';
import type Stripe from 'stripe';
import { sendMail } from '$lib/server/email/mailer';
import { enrollmentRevokedEmail, refundConfirmEmail } from '$lib/server/email/templates';

export const load: PageServerLoad = async ({ params }) => {
    const purchase = await db.query.purchases.findFirst({
        where: eq(purchases.id, params.id),
        with: {
            user: true,
            course: true,
        },
    });

    if (!purchase) error(404, 'Purchase not found');

    // Load the corresponding enrollment
    const enrollment = await db.query.enrollments.findFirst({
        where: and(
            eq(enrollments.userId, purchase.userId),
            eq(enrollments.courseId, purchase.courseId)
        ),
    });

    // Fetch Stripe data — graceful fallback on error
    let stripeData: {
        sessionId: string;
        paymentIntentId: string | null;
        paymentStatus: string | null;
        currency: string | null;
        amountTotal: number | null;
        amountDiscount: number | null;
        amountTax: number | null;
        paymentMethodType: string | null;
        card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
        paypal: { payerEmail: string | null } | null;
        billingDetails: Stripe.PaymentMethod.BillingDetails | null;
        customerDetails: Stripe.Checkout.Session.CustomerDetails | null;
        discounts: Array<{ code: string | null; amount: number }>;
        refunds: Array<{ id: string; amount: number; status: string; created: number; reason: string | null }>;
    } | null = null;
    let stripeError: string | null = null;

    try {
        const session = await stripe.checkout.sessions.retrieve(
            purchase.stripeCheckoutSessionId,
            { expand: ['payment_intent', 'payment_intent.payment_method', 'customer', 'total_details.breakdown'] }
        );

        const pi = session.payment_intent as Stripe.PaymentIntent | null;
        const pm = pi?.payment_method as Stripe.PaymentMethod | null;

        let refundsList: Stripe.Refund[] = [];
        if (pi?.id) {
            const refundsResponse = await stripe.refunds.list({ payment_intent: pi.id, limit: 10 });
            refundsList = refundsResponse.data;
        }

        const discounts = (session.total_details?.breakdown?.discounts || []).map((d) => ({
            code: (d.discount.coupon as Stripe.Coupon)?.id || null,
            amount: d.amount,
        }));

        stripeData = {
            sessionId: session.id,
            paymentIntentId: pi?.id ?? null,
            paymentStatus: pi?.status ?? session.payment_status ?? null,
            currency: session.currency,
            amountTotal: session.amount_total,
            amountDiscount: session.total_details?.amount_discount ?? null,
            amountTax: session.total_details?.amount_tax ?? null,
            paymentMethodType: pm?.type ?? null,
            card: pm?.card
                ? {
                      brand: pm.card.brand,
                      last4: pm.card.last4,
                      expMonth: pm.card.exp_month,
                      expYear: pm.card.exp_year,
                  }
                : null,
            paypal:
                pm?.type === 'paypal'
                    ? { payerEmail: (pm as any).paypal?.payer_email ?? null }
                    : null,
            billingDetails: pm?.billing_details ?? null,
            customerDetails: session.customer_details ?? null,
            discounts,
            refunds: refundsList.map((r) => ({
                id: r.id,
                amount: r.amount,
                status: r.status,
                created: r.created,
                reason: r.reason ?? null,
            })),
        };
    } catch (e: any) {
        stripeError = e.message || 'Could not load Stripe data';
    }

    return {
        purchase,
        enrollment: enrollment ?? null,
        stripeData,
        stripeError,
    };
};

export const actions: Actions = {
    refundPurchase: async ({ params }) => {
        const purchaseId = params.id;

        try {
            const purchase = await db.query.purchases.findFirst({
                where: eq(purchases.id, purchaseId),
                with: { user: true, course: true },
            });

            if (!purchase) return fail(404, { message: 'Purchase not found' });
            if (purchase.status === 'refunded') return fail(400, { message: 'Already refunded' });

            const session = await stripe.checkout.sessions.retrieve(purchase.stripeCheckoutSessionId);

            if (!session.payment_intent) {
                return fail(400, { message: 'No payment intent found for this session' });
            }

            await stripe.refunds.create({ payment_intent: session.payment_intent as string });

            await db.update(purchases).set({ status: 'refunded' }).where(eq(purchases.id, purchaseId));
            await db.update(enrollments).set({ status: 'cancelled' }).where(
                and(eq(enrollments.userId, purchase.userId), eq(enrollments.courseId, purchase.courseId))
            );

            // Send refund confirmation email
            await sendMail({
                to: purchase.user.email,
                subject: `Rückerstattung: ${purchase.course.title}`,
                html: refundConfirmEmail({
                    name: purchase.user.name,
                    courseTitle: purchase.course.title,
                    amount: purchase.amount,
                }),
            });

            return { success: true, action: 'refunded' };
        } catch (e: any) {
            console.error('Refund error:', e);
            return fail(500, { message: e.message || 'Failed to process refund' });
        }
    },

    markDisputed: async ({ params }) => {
        try {
            await db
                .update(purchases)
                .set({ status: 'disputed' })
                .where(eq(purchases.id, params.id));

            return { success: true, action: 'disputed' };
        } catch (e: any) {
            return fail(500, { message: e.message || 'Failed to update status' });
        }
    },

    restoreEnrollment: async ({ params, request }) => {
        const formData = await request.formData();
        const expiresAt = formData.get('expiresAt') as string | null;

        try {
            const purchase = await db.query.purchases.findFirst({
                where: eq(purchases.id, params.id),
                with: { course: true },
            });

            if (!purchase) return fail(404, { message: 'Purchase not found' });

            let newExpiresAt: Date | null = null;
            if (expiresAt) {
                newExpiresAt = new Date(expiresAt);
            } else if (purchase.course.accessType === 'duration' && purchase.course.accessDuration) {
                newExpiresAt = new Date();
                newExpiresAt.setDate(newExpiresAt.getDate() + purchase.course.accessDuration);
            }

            await db
                .update(enrollments)
                .set({ status: 'active', expiresAt: newExpiresAt })
                .where(
                    and(
                        eq(enrollments.userId, purchase.userId),
                        eq(enrollments.courseId, purchase.courseId)
                    )
                );

            return { success: true, action: 'enrollment_restored' };
        } catch (e: any) {
            return fail(500, { message: e.message || 'Failed to restore enrollment' });
        }
    },
};
