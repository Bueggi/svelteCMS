import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { enrollments } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey } from '$lib/server/settings';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) return error(401, 'Unauthorized');

    const { courseId } = await request.json();
    if (!courseId) return error(400, 'courseId required');

    const enrollment = await db.query.enrollments.findFirst({
        where: (e, { eq, and }) => and(
            eq(e.userId, locals.user!.id),
            eq(e.courseId, courseId)
        ),
    });

    if (!enrollment) return error(404, 'Enrollment not found');
    if (!enrollment.stripeSubscriptionId) return error(400, 'No Stripe subscription linked');

    const stripeKey = await getStripeKey();
    if (!stripeKey) return error(500, 'Stripe not configured');

    const stripe = getStripeClient(stripeKey);

    // Cancel at period end — user keeps access until billing cycle ends
    await stripe.subscriptions.update(enrollment.stripeSubscriptionId, {
        cancel_at_period_end: true,
    });

    await db.update(enrollments)
        .set({ cancelAtPeriodEnd: true })
        .where(and(
            eq(enrollments.userId, locals.user.id),
            eq(enrollments.courseId, courseId)
        ));

    return json({ ok: true });
};

// Allow re-activating (undo cancel) too
export const DELETE: RequestHandler = async ({ request, locals }) => {
    if (!locals.user) return error(401, 'Unauthorized');

    const { courseId } = await request.json();
    if (!courseId) return error(400, 'courseId required');

    const enrollment = await db.query.enrollments.findFirst({
        where: (e, { eq, and }) => and(
            eq(e.userId, locals.user!.id),
            eq(e.courseId, courseId)
        ),
    });

    if (!enrollment?.stripeSubscriptionId) return error(404, 'No active subscription');

    const stripeKey = await getStripeKey();
    if (!stripeKey) return error(500, 'Stripe not configured');

    const stripe = getStripeClient(stripeKey);

    await stripe.subscriptions.update(enrollment.stripeSubscriptionId, {
        cancel_at_period_end: false,
    });

    await db.update(enrollments)
        .set({ cancelAtPeriodEnd: false })
        .where(and(
            eq(enrollments.userId, locals.user.id),
            eq(enrollments.courseId, courseId)
        ));

    return json({ ok: true });
};
