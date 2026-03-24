import { db } from "$lib/server/db";
import { courses } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    const allCourses = await db.query.courses.findMany({
        where: eq(courses.isPublished, true),
        with: {
            instructor: true
        }
    });

    return {
        courses: allCourses
    };
};
