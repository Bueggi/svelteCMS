import { db } from '$lib/server/db';
import { courses, enrollments } from '$lib/server/db/schema';
import { desc, sql, eq } from 'drizzle-orm';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const allCourses = await db.query.courses.findMany({
        orderBy: [desc(courses.createdAt)],
        with: {
            instructor: true,
        },
        extras: {
            enrollmentCount: sql<number>`(
                SELECT count(*) 
                FROM enrollments 
                WHERE enrollments.course_id = courses.id
            )`.as('enrollment_count'),
            lifetimeRevenue: sql<number>`(
                SELECT COALESCE(SUM(amount), 0)
                FROM purchases
                WHERE purchases.course_id = courses.id
                AND purchases.status = 'completed'
            )`.as('lifetime_revenue'),
        },
    });

    return {
        courses: allCourses
    };
};

export const actions: Actions = {
    deleteCourse: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id');

        if (!id || typeof id !== 'string') {
            return fail(400, { message: 'Missing course ID' });
        }

        try {
            await db.delete(courses).where(eq(courses.id, id));
            return { success: true };
        } catch (e) {
            console.error(e);
            return fail(500, { message: 'Failed to delete course' });
        }
    }
};
