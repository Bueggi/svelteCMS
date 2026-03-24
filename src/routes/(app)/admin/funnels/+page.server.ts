import { db } from '$lib/server/db';
import { funnels, courses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
    const allFunnels = await db.query.funnels.findMany({
        with: { course: true },
        orderBy: (f, { desc }) => [desc(f.createdAt)],
    });
    const allCourses = await db.query.courses.findMany({
        where: eq(courses.isPublished, true),
    });
    return { funnels: allFunnels, courses: allCourses };
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        const name = (fd.get('name') as string)?.trim();
        const slug = (fd.get('slug') as string)?.trim().toLowerCase().replace(/\s+/g, '-');
        const courseId = fd.get('courseId') as string;
        if (!name || !slug || !courseId) return fail(400, { message: 'Missing fields' });
        const [created] = await db.insert(funnels).values({ name, slug, courseId }).returning({ id: funnels.id });
        return { created };
    },
    delete: async ({ request, locals }) => {
        if (!locals.user) return fail(403);
        const fd = await request.formData();
        const id = fd.get('id') as string;
        await db.delete(funnels).where(eq(funnels.id, id));
        return { success: true };
    },
};
