import { db } from '$lib/server/db';
import { funnels, funnelBumps, funnelUpsells, funnelCheckoutPages, courses } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
    const funnel = await db.query.funnels.findFirst({
        where: eq(funnels.id, params.id),
        with: {
            course: true,
            bumps: { with: { course: true }, orderBy: [asc(funnelBumps.order)] },
            upsells: { with: { course: true }, orderBy: [asc(funnelUpsells.order)] },
            checkoutPages: { orderBy: [asc(funnelCheckoutPages.order)] },
        },
    });
    if (!funnel) throw error(404);
    const allCourses = await db.query.courses.findMany({ orderBy: (c, { asc }) => [asc(c.title)] });
    return { funnel, courses: allCourses };
};

export const actions: Actions = {
    updateMeta: async ({ request, params, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        await db.update(funnels).set({
            name: (fd.get('name') as string)?.trim(),
            slug: (fd.get('slug') as string)?.trim().toLowerCase().replace(/\s+/g, '-'),
            isActive: fd.get('isActive') === 'true',
            trackingPixels: (fd.get('trackingPixels') as string) || null,
            sandboxMode: fd.get('sandboxMode') === 'true',
            updatedAt: new Date(),
        }).where(eq(funnels.id, params.id));
        return { success: true };
    },
    addBump: async ({ request, params, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        const courseId = fd.get('courseId') as string;
        const label = fd.get('label') as string;
        const specialPrice = fd.get('specialPrice') ? parseInt(fd.get('specialPrice') as string) * 100 : null;
        if (!courseId) return fail(400);
        const existing = await db.query.funnelBumps.findMany({ where: eq(funnelBumps.funnelId, params.id) });
        await db.insert(funnelBumps).values({ funnelId: params.id, courseId, label: label || null, specialPrice, order: existing.length });
        return { success: true };
    },
    removeBump: async ({ request, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        await db.delete(funnelBumps).where(eq(funnelBumps.id, fd.get('id') as string));
        return { success: true };
    },
    addUpsell: async ({ request, params, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        const courseId = fd.get('courseId') as string;
        if (!courseId) return fail(400);
        const existing = await db.query.funnelUpsells.findMany({ where: eq(funnelUpsells.funnelId, params.id) });
        await db.insert(funnelUpsells).values({
            funnelId: params.id,
            courseId,
            order: existing.length,
            specialPrice: fd.get('specialPrice') ? parseInt(fd.get('specialPrice') as string) * 100 : null,
        });
        return { success: true };
    },
    removeUpsell: async ({ request, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        await db.delete(funnelUpsells).where(eq(funnelUpsells.id, fd.get('id') as string));
        return { success: true };
    },
    addCheckoutPage: async ({ request, params, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        const name = (fd.get('name') as string)?.trim();
        const slug = (fd.get('slug') as string)?.trim().toLowerCase().replace(/\s+/g, '-');
        if (!name || !slug) return fail(400);
        const existing = await db.query.funnelCheckoutPages.findMany({ where: eq(funnelCheckoutPages.funnelId, params.id) });
        const [created] = await db.insert(funnelCheckoutPages).values({ funnelId: params.id, name, slug, order: existing.length }).returning({ id: funnelCheckoutPages.id });
        return { created };
    },
    removeCheckoutPage: async ({ request, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        await db.delete(funnelCheckoutPages).where(eq(funnelCheckoutPages.id, fd.get('id') as string));
        return { success: true };
    },
};
