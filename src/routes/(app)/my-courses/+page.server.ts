import { db } from '$lib/server/db';
import { courses, enrollments, userProgress, lessons, modules } from '$lib/server/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    // Fetch user's enrollments with course details
    const userEnrollments = await db.query.enrollments.findMany({
        where: eq(enrollments.userId, locals.user.id),
        with: {
            course: {
                with: {
                    modules: {
                        with: {
                            lessons: true
                        }
                    }
                }
            }
        },
        orderBy: [desc(enrollments.enrolledAt)]
    });

    // Calculate progress for each enrollment
    // We need to fetch progress separately or process it here.
    // Let's fetch all progress for this user to map it easily.
    const progress = await db.query.userProgress.findMany({
        where: eq(userProgress.userId, locals.user.id)
    });

    const completedLessonIds = new Set(progress.filter(p => p.isCompleted).map(p => p.lessonId));

    const enrolledCourses = userEnrollments.map(enrollment => {
        const course = enrollment.course;
        
        // Calculate progress
        let totalLessons = 0;
        let completedLessons = 0;

        course.modules.forEach(module => {
            module.lessons.forEach(lesson => {
                totalLessons++;
                if (completedLessonIds.has(lesson.id)) {
                    completedLessons++;
                }
            });
        });

        const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return {
            ...course,
            enrolledAt: enrollment.enrolledAt,
            progress: progressPercent,
            totalLessons,
            completedLessons
        };
    });

    return {
        enrolledCourses
    };
};
