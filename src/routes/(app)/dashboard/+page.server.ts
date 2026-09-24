import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { enrollments, userProgress } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { hasActiveAccess } from '$lib/server/access';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const userId = locals.user.id;

    // Load all enrollments with full course/module/lesson tree
    const userEnrollments = await db.query.enrollments.findMany({
        where: eq(enrollments.userId, userId),
        with: {
            course: {
                with: {
                    modules: {
                        with: { lessons: true },
                        orderBy: (m, { asc }) => [asc(m.order)]
                    }
                }
            }
        },
        orderBy: (e, { desc }) => [desc(e.enrolledAt)]
    });

    const progress = await db.query.userProgress.findMany({
        where: eq(userProgress.userId, userId)
    });

    const completedSet = new Set(progress.filter(p => p.isCompleted).map(p => p.lessonId));

    const enrolledCourses = userEnrollments
        .filter(e => hasActiveAccess(e))
        .map(enrollment => {
            const course = enrollment.course;
            let totalLessons = 0;
            let completedLessons = 0;
            let firstUnfinishedSlug: string | null = null;

            for (const mod of course.modules) {
                for (const lesson of mod.lessons) {
                    totalLessons++;
                    if (completedSet.has(lesson.id)) {
                        completedLessons++;
                    } else if (!firstUnfinishedSlug) {
                        firstUnfinishedSlug = lesson.id;
                    }
                }
            }

            const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

            return {
                id: course.id,
                title: course.title,
                subtitle: course.subtitle,
                slug: course.slug,
                thumbnailUrl: course.thumbnailUrl,
                progress: progressPct,
                totalLessons,
                completedLessons,
                enrolledAt: enrollment.enrolledAt,
                expiresAt: enrollment.expiresAt,
                firstUnfinishedLesson: firstUnfinishedSlug,
            };
        });

    // Stats
    const activeCourses = enrolledCourses.filter(c => c.progress < 100).length;
    const completedCourses = enrolledCourses.filter(c => c.progress === 100).length;
    const totalCompletedLessons = enrolledCourses.reduce((s, c) => s + c.completedLessons, 0);
    const totalLessonsAll = enrolledCourses.reduce((s, c) => s + c.totalLessons, 0);

    // Resume course: first in-progress (progress > 0, < 100), else first enrolled
    const resumeCourse =
        enrolledCourses.find(c => c.progress > 0 && c.progress < 100) ??
        enrolledCourses.find(c => c.progress === 0) ??
        null;

    // Expiring in next 30 days
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiringEnrollments = userEnrollments
        .filter(e => e.expiresAt && e.expiresAt > new Date() && e.expiresAt <= soon)
        .map(e => ({
            courseTitle: e.course.title,
            courseSlug: e.course.slug,
            expiresAt: e.expiresAt!,
            daysLeft: Math.ceil((e.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }));

    return {
        user: locals.user,
        enrolledCourses,
        resumeCourse,
        stats: {
            activeCourses,
            completedCourses,
            totalEnrolled: enrolledCourses.length,
            completedLessons: totalCompletedLessons,
            totalLessons: totalLessonsAll,
            overallProgress: totalLessonsAll > 0 ? Math.round((totalCompletedLessons / totalLessonsAll) * 100) : 0,
        },
        expiringEnrollments,
    };
};
