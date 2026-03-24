import { db } from '$lib/server/db';
import { funnels, funnelCheckoutPages } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const cp = await db.query.funnelCheckoutPages.findFirst({
        where: eq(funnelCheckoutPages.id, params.cpId),
        with: { funnel: { columns: { id: true, name: true, slug: true } } },
    });
    if (!cp) throw error(404);
    return { cp };
};

export const actions = {
    save: async ({ request, params }) => {
        const fd = await request.formData();
        await db.update(funnelCheckoutPages).set({ blocks: fd.get('blocks') as string, updatedAt: new Date() }).where(eq(funnelCheckoutPages.id, params.cpId));
        return { success: true };
    },
    publish: async ({ request, params }) => {
        const fd = await request.formData();
        await db.update(funnelCheckoutPages).set({ status: fd.get('status') as string, updatedAt: new Date() }).where(eq(funnelCheckoutPages.id, params.cpId));
        return { success: true };
    },
};
