import { db } from '$lib/server/db';
import { funnels, funnelUpsells } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const funnel = await db.query.funnels.findFirst({
        where: eq(funnels.slug, params.slug),
        with: {
            upsells: { with: { course: true }, orderBy: [asc(funnelUpsells.order)] },
        },
    });
    if (!funnel) throw error(404);

    const upsell = funnel.upsells.find(u => u.id === params.upsellId);
    if (!upsell) throw error(404);

    const currentIndex = funnel.upsells.findIndex(u => u.id === params.upsellId);
    const nextUpsell = funnel.upsells[currentIndex + 1] ?? null;

    return { funnel, upsell, nextUpsell };
};
