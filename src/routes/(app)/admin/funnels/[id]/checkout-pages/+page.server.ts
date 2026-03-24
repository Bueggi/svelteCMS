import { db } from '$lib/server/db';
import { funnels, funnelCheckoutPages } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const funnel = await db.query.funnels.findFirst({
        where: eq(funnels.id, params.id),
        columns: { id: true, name: true, slug: true },
        with: { checkoutPages: { orderBy: [asc(funnelCheckoutPages.order)] } },
    });
    if (!funnel) throw error(404);
    return { funnel };
};
