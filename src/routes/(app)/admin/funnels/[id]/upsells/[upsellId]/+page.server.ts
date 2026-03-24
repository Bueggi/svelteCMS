import { db } from '$lib/server/db';
import { funnels, funnelUpsells } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
    const funnel = await db.query.funnels.findFirst({
        where: eq(funnels.id, params.id),
        columns: { id: true, name: true, slug: true },
    });
    if (!funnel) throw error(404);

    const upsell = await db.query.funnelUpsells.findFirst({
        where: eq(funnelUpsells.id, params.upsellId),
        with: { course: { columns: { title: true } } },
    });
    if (!upsell || upsell.funnelId !== params.id) throw error(404);

    return { funnel, upsell };
};

export const actions: Actions = {
    save: async ({ request, params, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        await db.update(funnelUpsells)
            .set({ blocks: fd.get('blocks') as string, updatedAt: new Date() })
            .where(eq(funnelUpsells.id, params.upsellId));
        return { success: true };
    },
    publish: async ({ request, params, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        await db.update(funnelUpsells)
            .set({ status: fd.get('status') as string, updatedAt: new Date() })
            .where(eq(funnelUpsells.id, params.upsellId));
        return { success: true };
    },
};
