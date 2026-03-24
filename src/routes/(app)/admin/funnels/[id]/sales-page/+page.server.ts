import { db } from '$lib/server/db';
import { funnels } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const funnel = await db.query.funnels.findFirst({
        where: eq(funnels.id, params.id),
        columns: { id: true, name: true, slug: true, salesPageBlocks: true, salesPageStatus: true, checkoutMode: true },
    });
    if (!funnel) throw error(404);
    return { funnel };
};

export const actions = {
    save: async ({ request, params }) => {
        const fd = await request.formData();
        await db.update(funnels).set({ salesPageBlocks: fd.get('blocks') as string, updatedAt: new Date() }).where(eq(funnels.id, params.id));
        return { success: true };
    },
    publish: async ({ request, params }) => {
        const fd = await request.formData();
        await db.update(funnels).set({ salesPageStatus: fd.get('status') as string, updatedAt: new Date() }).where(eq(funnels.id, params.id));
        return { success: true };
    },
    setCheckoutMode: async ({ request, params }) => {
        const fd = await request.formData();
        await db.update(funnels).set({ checkoutMode: fd.get('checkoutMode') as string, updatedAt: new Date() }).where(eq(funnels.id, params.id));
        return { success: true };
    },
};
