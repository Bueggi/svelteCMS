import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { courses, modules, lessons } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
    // 1. Authorize: Only Admins and Instructors can preview
    const user = locals.user as any;
    if (!user || (user.role !== 'admin' && user.role !== 'instructor')) {
        throw redirect(302, '/login');
    }

    const courseSlug = params.slug;

    // 2. Fetch Course by Slug (Bypassing enrollment checks)
    const course = await db.query.courses.findFirst({
        where: eq(courses.slug, courseSlug),
        with: {
            instructor: true,
            modules: {
                orderBy: [asc(modules.order)],
                with: {
                    lessons: {
                        orderBy: [asc(lessons.order)]
                    }
                }
            }
        }
    });

    if (!course) {
        throw redirect(302, '/admin/courses');
    }

    // 3. For preview, we don't care about real progress
    const completedLessonIds = new Set();

    return {
        course,
        completedLessonIds,
        preview: true
    };
};
