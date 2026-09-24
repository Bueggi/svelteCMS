
import { db } from '$lib/server/db';
import { enrollments, courses, communityPosts } from '$lib/server/db/schema';
import { eq, desc, sql, inArray, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { activeEnrollmentFilter } from '$lib/server/access';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    // 1. Fetch enrolled courses
    const userEnrollments = await db.query.enrollments.findMany({
        where: and(eq(enrollments.userId, locals.user.id), activeEnrollmentFilter()),
        with: {
            course: true
        }
    });

    // If admin/instructor, fetch ALL courses with community enabled
    let accessibleCourses = [];
    if (['admin', 'instructor', 'moderator'].includes(locals.user.role ?? '')) {
        accessibleCourses = await db.query.courses.findMany({
            where: eq(courses.communityEnabled, true),
            orderBy: [desc(courses.createdAt)]
        });
    } else {
        if (userEnrollments.length > 0) {
            accessibleCourses = userEnrollments
                .map(e => e.course)
                .filter(c => c.communityEnabled);
        }
    }

    return {
        communities: accessibleCourses
    };
};
