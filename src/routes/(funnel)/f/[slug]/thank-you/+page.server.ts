import { db } from '$lib/server/db';
import { funnels, purchases } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
    const funnel = await db.query.funnels.findFirst({
        where: eq(funnels.slug, params.slug),
        with: { course: true },
    });
    if (!funnel) throw error(404);

    // Look up the purchase from the Stripe session_id if present
    let purchase: { amount: number; createdAt: Date } | null = null;
    const sessionId = url.searchParams.get('session_id');
    if (sessionId) {
        const row = await db.query.purchases.findFirst({
            where: eq(purchases.stripeCheckoutSessionId, sessionId),
            columns: { amount: true, createdAt: true },
        });
        if (row) purchase = row;
    }

    return {
        funnel,
        blocks: funnel.thankYouBlocks ? JSON.parse(funnel.thankYouBlocks) : [],
        purchase,
    };
};
