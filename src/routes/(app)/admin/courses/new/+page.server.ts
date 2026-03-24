import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { courses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) {
            return fail(401, { message: "Unauthorized" });
        }

        const data = await request.formData();
        const title = data.get('title') as string;

        if (!title) {
            return fail(400, { message: "Title is required" });
        }

        const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        let slug = baseSlug;
        let counter = 1;

        // Ensure unique slug
        while (true) {
            const existingCourse = await db.query.courses.findFirst({
                where: eq(courses.slug, slug)
            });

            if (!existingCourse) break;

            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        try {
            const [newCourse] = await db.insert(courses).values({
                title,
                slug,
                instructorId: locals.user.id,
                isPublished: false
            }).returning();

            throw redirect(303, `/admin/courses/${newCourse.id}`);
        } catch (error) {
            if ((error as any).status === 303) throw error;
            console.error('Error creating course:', error);
            return fail(500, { message: "Failed to create course" });
        }
    }
};
