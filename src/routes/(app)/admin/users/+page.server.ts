import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, purchases, enrollments, courses } from '$lib/server/db/schema';
import { eq, ilike, or, sql, desc, and, inArray, gte } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) throw redirect(302, '/login');

    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    
    // Filters
    const courseId = url.searchParams.get('courseId');
    const minClv = Number(url.searchParams.get('minClv')) || 0;

    // Build conditions array
    const conditions = [];

    if (search) {
        conditions.push(or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`)));
    }

    if (courseId) {
        // Subquery: Users enrolled in this course
        const enrolledUserIds = db
            .select({ userId: enrollments.userId })
            .from(enrollments)
            .where(eq(enrollments.courseId, courseId));
        
        conditions.push(inArray(user.id, enrolledUserIds));
    }

    if (minClv > 0) {
        // Subquery: Users with total purchases >= minClv
        // Note: Amount is in cents.
        const highValueUserIds = db
            .select({ userId: purchases.userId })
            .from(purchases)
            .groupBy(purchases.userId)
            .having(sql`sum(${purchases.amount}) >= ${minClv * 100}`); // Convert input dollars to cents
            
        conditions.push(inArray(user.id, highValueUserIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch users
    const users = await db.query.user.findMany({
        where: whereClause,
        limit,
        offset,
        with: {
            enrollments: true,
        },
        orderBy: [desc(user.createdAt)],
    });

    // Calculate CLV (still needed for display)
    const userIds = users.map(u => u.id);
    let clvMap: Record<string, number> = {};

    if (userIds.length > 0) {
        const purchaseData = await db
            .select({
                userId: purchases.userId,
                total: sql<number>`sum(${purchases.amount})`
            })
            .from(purchases)
            .where(inArray(purchases.userId, userIds))
            .groupBy(purchases.userId);
            
        purchaseData.forEach(p => {
            clvMap[p.userId] = p.total || 0;
        });
    }

    const enhancedUsers = users.map(u => ({
        ...u,
        clv: clvMap[u.id] || 0,
        productCount: u.enrollments.length
    }));

    // Get total count
    const totalCountRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(user)
        .where(whereClause);
        
    const totalCount = Number(totalCountRes[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch all courses for the filter dropdown
    const allCourses = await db.query.courses.findMany({
        columns: { id: true, title: true },
        orderBy: [desc(courses.createdAt)]
    });

    return {
        users: enhancedUsers,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages
        },
        filters: {
            courses: allCourses,
            activeCourseId: courseId,
            activeMinClv: minClv
        }
    };
};
