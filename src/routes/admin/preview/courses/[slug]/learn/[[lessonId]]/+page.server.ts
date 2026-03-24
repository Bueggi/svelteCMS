import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }: { params: any, parent: any }) => {
    const { lessonId } = params;
    const { course } = (await parent()) as { course: any };

    // If no lessonId, redirect to the first lesson of the course (preview mode)
    if (!lessonId) {
        if (course.modules.length > 0 && course.modules[0].lessons.length > 0) {
            const firstLessonId = course.modules[0].lessons[0].id;
            throw redirect(302, `/admin/preview/courses/${params.slug}/learn/${firstLessonId}`);
        }
    }

    // Find the requested lesson (bypass isPublished checks)
    let activeLesson = null;
    let nextLessonId = null;
    let prevLessonId = null;

    const allLessons = (course.modules as any[]).flatMap(m => m.lessons);
    const currentIndex = (allLessons as any[]).findIndex(l => l.id === lessonId);

    if (currentIndex !== -1) {
        activeLesson = allLessons[currentIndex];
        if (currentIndex < allLessons.length - 1) {
            nextLessonId = allLessons[currentIndex + 1].id;
        }
        if (currentIndex > 0) {
            prevLessonId = allLessons[currentIndex - 1].id;
        }
    }

    return {
        activeLesson,
        nextLessonId,
        prevLessonId
    };
};
