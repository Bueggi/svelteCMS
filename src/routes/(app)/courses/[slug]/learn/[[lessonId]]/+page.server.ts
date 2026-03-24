import { redirect, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { userProgress, moduleRatings, courses, lessons, enrollments } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { fireAutomations } from '$lib/server/automations';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
    const { lessonId } = params;
    const { course, unlockedLessonIds, daysSinceEnrollment } = await parent();

    const allLessons = course.modules.flatMap((m: any) => m.lessons);

    // Default: redirect to first unlocked lesson
    if (!lessonId) {
        const first = allLessons.find((l: any) => unlockedLessonIds.has(l.id));
        if (first) throw redirect(302, `/courses/${params.slug}/learn/${first.id}`);
    }

    let activeLesson = null;
    let nextLessonId = null;
    let prevLessonId = null;
    let isLocked = false;

    const currentIndex = allLessons.findIndex((l: any) => l.id === lessonId);

    if (currentIndex !== -1) {
        const lesson = allLessons[currentIndex];
        isLocked = !unlockedLessonIds.has(lesson.id);

        const unlockDaysLeft = isLocked && lesson.dripDays != null
            ? lesson.dripDays - daysSinceEnrollment
            : null;

        activeLesson = { ...lesson, isLocked, unlockDaysLeft };

        if (!isLocked) {
            for (let i = currentIndex + 1; i < allLessons.length; i++) {
                if (unlockedLessonIds.has(allLessons[i].id)) { nextLessonId = allLessons[i].id; break; }
            }
            for (let i = currentIndex - 1; i >= 0; i--) {
                if (unlockedLessonIds.has(allLessons[i].id)) { prevLessonId = allLessons[i].id; break; }
            }
        }
    }

    // Load current module + user's existing rating for it
    let moduleRatingData: { moduleId: string; moduleName: string; rating: number | null } | null = null;
    if (lessonId && locals.user) {
        const currentModule = course.modules.find((m: any) => m.lessons.some((l: any) => l.id === lessonId));
        if (currentModule) {
            const existing = await db.query.moduleRatings.findFirst({
                where: and(
                    eq(moduleRatings.userId, locals.user.id),
                    eq(moduleRatings.moduleId, currentModule.id)
                )
            });
            moduleRatingData = {
                moduleId: currentModule.id,
                moduleName: currentModule.title,
                rating: existing?.rating ?? null,
            };
        }
    }

    return { activeLesson, nextLessonId, prevLessonId, moduleRatingData };
};

export const actions: Actions = {
    complete: async ({ request, locals, params }) => {
        if (!locals.user) return fail(401, { message: 'Unauthorized' });

        const data = await request.formData();
        const lessonId = data.get('lessonId') as string;

        if (!lessonId) return fail(400, { message: 'Lesson ID is required' });

        try {
            await db.insert(userProgress).values({
                userId: locals.user.id,
                lessonId,
                isCompleted: true,
                completedAt: new Date()
            }).onConflictDoNothing();

            // Fire lesson.completed automation
            const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
            const course = await db.query.courses.findFirst({ where: eq(courses.slug, params.slug) });
            const u = locals.user;

            if (lesson && course) {
                const baseData = {
                    user: { id: u.id, email: u.email, name: u.name },
                    course: { id: course.id, title: course.title, slug: course.slug },
                    lesson: { id: lesson.id, title: lesson.title },
                };
                fireAutomations('lesson.completed', baseData);

                // Check if all lessons in the course are now complete
                const allLessons = await db.query.lessons.findMany({
                    where: eq(lessons.moduleId, lesson.moduleId), // rough proxy — see below
                });
                // Use a broader check: load all progress for this course
                const enrollment = await db.query.enrollments.findFirst({
                    where: and(eq(enrollments.userId, u.id), eq(enrollments.courseId, course.id)),
                });
                if (enrollment) {
                    const { modules: courseModules } = await db.query.courses.findFirst({
                        where: eq(courses.id, course.id),
                        with: { modules: { with: { lessons: true } } },
                    }) as any;
                    const allCourseLessonIds: string[] = courseModules.flatMap((m: any) => m.lessons.map((l: any) => l.id));
                    const progress = await db.query.userProgress.findMany({
                        where: and(eq(userProgress.userId, u.id)),
                    });
                    const completedIds = new Set(progress.filter((p: any) => p.isCompleted).map((p: any) => p.lessonId));
                    // Include the lesson we just marked
                    completedIds.add(lessonId);

                    if (allCourseLessonIds.every(id => completedIds.has(id))) {
                        fireAutomations('course.completed', {
                            user: { id: u.id, email: u.email, name: u.name },
                            course: { id: course.id, title: course.title, slug: course.slug },
                        });
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Error marking lesson complete:', error);
            return fail(500, { message: 'Failed to update progress' });
        }
    },

    rateModule: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { message: 'Unauthorized' });

        const data = await request.formData();
        const moduleId = data.get('moduleId') as string;
        const rating = parseInt(data.get('rating') as string);

        if (!moduleId || !rating || rating < 1 || rating > 5) return fail(400, { message: 'Invalid rating' });

        await db.insert(moduleRatings)
            .values({ userId: locals.user.id, moduleId, rating, updatedAt: new Date() })
            .onConflictDoUpdate({
                target: [moduleRatings.userId, moduleRatings.moduleId],
                set: { rating, updatedAt: new Date() },
            });

        return { success: true };
    }
};
