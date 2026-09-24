
import { db } from '$lib/server/db';
import { courses, enrollments, communityCategories } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { hasActiveAccess } from '$lib/server/access';

export const load: LayoutServerLoad = async ({ params, locals, parent }) => {
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    const { courseSlug } = params;

    const course = await db.query.courses.findFirst({
        where: eq(courses.slug, courseSlug),
        with: {
            communityCategories: {
                orderBy: [asc(communityCategories.order)]
            }
        }
    });

    if (!course) {
        throw error(404, 'Course not found');
    }

    // Check enrollment if not admin/instructor/moderator
    if (!['admin', 'instructor', 'moderator'].includes(locals.user.role ?? '')) {
        const enrollment = await db.query.enrollments.findFirst({
            where: and(
                eq(enrollments.userId, locals.user.id),
                eq(enrollments.courseId, course.id)
            )
        });

        if (!hasActiveAccess(enrollment)) {
            throw error(403, 'You are not enrolled in this course.');
        }
    }

    return {
        communityCourse: course,
        categories: course.communityCategories
    };
};
