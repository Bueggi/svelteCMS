import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { courses, enrollments, modules, lessons, userProgress } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
    if (!locals.user) {
        throw redirect(302, `/login?redirectTo=/courses/${params.slug}/learn`);
    }

    const userId = locals.user.id;
    const courseSlug = params.slug;

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

    if (!course) throw redirect(302, '/dashboard');

    const enrollment = await db.query.enrollments.findFirst({
        where: and(
            eq(enrollments.userId, userId),
            eq(enrollments.courseId, course.id)
        )
    });

    if (!enrollment) throw redirect(302, `/courses/${courseSlug}`);

    // Drip: compute which lessons are unlocked based on enrollment date
    const enrolledAt = enrollment.enrolledAt;
    const now = new Date();
    const daysSinceEnrollment = Math.floor((now.getTime() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24));

    // A lesson is available if: dripDays is null OR dripDays <= daysSinceEnrollment
    const unlockedLessonIds = new Set<string>(
        course.modules
            .flatMap(m => m.lessons)
            .filter(l => l.dripDays === null || l.dripDays === undefined || l.dripDays <= daysSinceEnrollment)
            .map(l => l.id)
    );

    const progress = await db.query.userProgress.findMany({
        where: eq(userProgress.userId, userId)
    });

    const completedLessonIds = new Set(progress.filter(p => p.isCompleted).map(p => p.lessonId));

    return {
        course,
        completedLessonIds,
        unlockedLessonIds,
        enrolledAt,
        daysSinceEnrollment,
    };
};
