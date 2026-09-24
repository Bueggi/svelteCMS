import { and, eq, inArray, like, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { courses, enrollments, purchases, user } from '$lib/server/db/schema';
import { sendMail } from '$lib/server/email/mailer';
import { enrollmentRevokedEmail, refundConfirmEmail } from '$lib/server/email/templates';

// Provider-independent reactions to refunds, chargebacks and failed payments,
// shared by the Stripe and PayPal webhooks.

export type RevokeReason = 'refund' | 'dispute' | 'payment_failed';
export type AccessTarget = { userId: string; courseId: string; purchaseId?: string };

/**
 * Purchases created from one order. Multi-course orders store `<orderRef>` for the main
 * course and `<orderRef>_<i>` for add-ons (Stripe: checkout session id, PayPal: `paypal_<orderId>`).
 */
export async function purchasesForOrder(orderRef: string) {
    return db.query.purchases.findMany({
        where: or(
            eq(purchases.stripeCheckoutSessionId, orderRef),
            like(purchases.stripeCheckoutSessionId, `${orderRef}_%`),
        ),
    });
}

export function targetsFromPurchases(rows: { id: string; userId: string; courseId: string }[]): AccessTarget[] {
    return rows.map(p => ({ userId: p.userId, courseId: p.courseId, purchaseId: p.id }));
}

/** Cancels course access, marks the purchases and notifies the buyer. */
export async function revokeCourseAccess(opts: {
    targets: AccessTarget[];
    reason: RevokeReason;
    purchaseStatus: 'refunded' | 'disputed' | 'failed';
    refundedAmount?: number;
}) {
    const { targets, reason, purchaseStatus, refundedAmount } = opts;

    for (const t of targets) {
        const revoked = await db.update(enrollments)
            .set({ status: 'cancelled', cancelAtPeriodEnd: false })
            .where(and(
                eq(enrollments.userId, t.userId),
                eq(enrollments.courseId, t.courseId),
                inArray(enrollments.status, ['active', 'suspended']),
            ))
            .returning({ courseId: enrollments.courseId });

        // Invoices are not touched here: refunds get their own correction document (issueCorrection)
        if (t.purchaseId) {
            await db.update(purchases).set({ status: purchaseStatus }).where(eq(purchases.id, t.purchaseId));
        }

        if (revoked.length === 0) continue;
        const buyer = await db.query.user.findFirst({ where: eq(user.id, t.userId) });
        const course = await db.query.courses.findFirst({ where: eq(courses.id, t.courseId) });
        if (!buyer || !course) continue;
        await sendMail({
            to: buyer.email,
            subject: reason === 'refund' ? `Rückerstattung: ${course.title}` : `Kurszugang beendet: ${course.title}`,
            html: reason === 'refund' && refundedAmount !== undefined
                ? refundConfirmEmail({ name: buyer.name, courseTitle: course.title, amount: refundedAmount })
                : enrollmentRevokedEmail({ name: buyer.name, courseTitle: course.title, reason }),
        });
    }
}

/**
 * Restores access after a dispute was decided in the seller's favour.
 * Only purchases still marked `disputed` are touched, so refunds stay revoked.
 */
export async function restoreDisputedAccess(targets: AccessTarget[]) {
    for (const t of targets) {
        if (!t.purchaseId) continue;
        const restored = await db.update(purchases)
            .set({ status: 'completed' })
            .where(and(eq(purchases.id, t.purchaseId), eq(purchases.status, 'disputed')))
            .returning({ id: purchases.id });
        if (restored.length === 0) continue;

        await db.update(enrollments)
            .set({ status: 'active' })
            .where(and(
                eq(enrollments.userId, t.userId),
                eq(enrollments.courseId, t.courseId),
                eq(enrollments.status, 'cancelled'),
            ));
    }
}
