import { error } from '@sveltejs/kit';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey } from '$lib/server/settings';
import { db } from '$lib/server/db';
import { courses, upsells } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    const sessionId = url.searchParams.get('session_id');
    const courseSlug = url.searchParams.get('course');

    if (!sessionId || !courseSlug) {
        throw error(400, 'Invalid thank-you page parameters');
    }

    // Verify the session with Stripe
    const stripeKey = await getStripeKey();
    if (!stripeKey) throw error(500, 'Stripe is not configured');
    const stripe = getStripeClient(stripeKey);

    let stripeSession: any = null;
    try {
        stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
        console.error('Failed to retrieve Stripe session', e);
        throw error(404, 'Session not found');
    }

    if (stripeSession.payment_status !== 'paid') {
        throw error(400, 'Payment not completed');
    }

    // Load the main course
    const course = await db.query.courses.findFirst({
        where: eq(courses.slug, courseSlug)
    });

    if (!course) throw error(404, 'Course not found');

    // Load post-purchase upsell offer (the first active upsell not already purchased in this session)
    const purchasedIds = (stripeSession.metadata?.courseIds || stripeSession.metadata?.courseId || '')
        .split(',').map((s: string) => s.trim()).filter(Boolean);

    const nextUpsell = await db.query.upsells.findFirst({
        where: and(
            eq(upsells.sourceCourseId, course.id),
            eq(upsells.isActive, true)
        ),
        with: { upsellCourse: true },
        orderBy: (u, { asc }) => [asc(u.order)]
    }).then(u => {
        // Filter out already purchased courses
        if (!u) return null;
        if (purchasedIds.includes(u.upsellCourse.id)) return null;
        return u;
    });

    return {
        course,
        nextUpsell,
        customerName: stripeSession.customer_details?.name || null,
        purchasedCourseIds: purchasedIds,
    };
};
