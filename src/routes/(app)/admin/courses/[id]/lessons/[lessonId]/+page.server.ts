import { db } from '$lib/server/db';
import { lessons } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const lesson = await db.query.lessons.findFirst({
        where: eq(lessons.id, params.lessonId),
        with: {
            module: {
                with: {
                    course: true
                }
            }
        }
    });

    if (!lesson) throw redirect(302, `/admin/courses/${params.id}`);

    return {
        lesson,
        courseSlug: lesson.module.course.slug
    };
};

export const actions: Actions = {
    updateLesson: async ({ params, request, locals }) => {
        if (!locals.user) return fail(401);

        const data = await request.formData();
        const title = data.get('title') as string;
        const videoUrl = data.get('videoUrl') as string;
        const content = data.get('content') as string;
        const isPublished = data.get('isPublished') === 'on';
        const isFreePreview = data.get('isFreePreview') === 'on';
        const duration = parseInt(data.get('duration') as string) || 0;
        const dripDaysRaw = data.get('dripDays') as string;
        const dripDays = dripDaysRaw ? parseInt(dripDaysRaw) || null : null;

        if (!title) return fail(400, { message: 'Title is required' });

        try {
            await db.update(lessons)
                .set({
                    title,
                    videoUrl,
                    content,
                    isPublished,
                    isFreePreview,
                    duration,
                    dripDays,
                    updatedAt: new Date()
                })
                .where(eq(lessons.id, params.lessonId));

            return { success: true };
        } catch (error) {
            console.error('Update lesson error:', error);
            return fail(500, { message: 'Failed to update lesson' });
        }
    }
};
