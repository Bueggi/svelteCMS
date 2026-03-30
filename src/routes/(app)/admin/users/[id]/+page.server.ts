import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, enrollments, communityPosts, courses, purchases } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { sendMail } from '$lib/server/email/mailer';
import { enrollmentRevokedEmail } from '$lib/server/email/templates';

export const load: PageServerLoad = async ({ params, locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const userId = params.id;

    // Fetch user details
    const userProfile = await db.query.user.findFirst({
        where: eq(user.id, userId),
    });

    if (!userProfile) throw redirect(302, '/admin/users');

    // Fetch Enrollments (and available courses to add)
    const userEnrollments = await db.query.enrollments.findMany({
        where: eq(enrollments.userId, userId),
        with: {
            course: true
        }
    });

    const allCourses = await db.query.courses.findMany({
        columns: { id: true, title: true }
    });

    // Determine available courses (not enrolled)
    const enrolledCourseIds = new Set(userEnrollments.map(e => e.courseId));
    const availableCourses = allCourses.filter(c => !enrolledCourseIds.has(c.id));

    // Fetch Recent Activity (Posts)
    const recentActivity = await db.query.communityPosts.findMany({
        where: eq(communityPosts.authorId, userId),
        orderBy: [desc(communityPosts.createdAt)],
        limit: 5,
        with: {
            category: true
        }
    });

    // Fetch Purchase History
    const userPurchases = await db.query.purchases.findMany({
        where: eq(purchases.userId, userId),
        orderBy: [desc(purchases.createdAt)],
        with: {
            course: true
        }
    });

    return {
        profile: userProfile,
        enrollments: userEnrollments,
        availableCourses,
        recentActivity,
        purchases: userPurchases
    };
};

export const actions: Actions = {
    updateProfile: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const name = data.get('name') as string;
        const email = data.get('email') as string;
        const role = data.get('role') as 'student' | 'admin' | 'instructor';

        try {
            await db.update(user)
                .set({ name, email, role, updatedAt: new Date() })
                .where(eq(user.id, params.id));
            
            return { success: true, message: 'Profile updated successfully' };
        } catch (error) {
            console.error('Update profile error:', error);
            return fail(500, { message: 'Failed to update profile' });
        }
    },

    addEnrollment: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const courseId = data.get('courseId') as string;

        if (!courseId) return fail(400, { message: 'Missing course ID' });

        try {
            // Fetch course to check access settings
            const course = await db.query.courses.findFirst({
                where: eq(courses.id, courseId),
                columns: { accessType: true, accessDuration: true }
            });

            let expiresAt: Date | null = null;
            
            if (course && (course.accessType === 'duration' || course.accessType === 'subscription') && course.accessDuration) {
                expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + course.accessDuration);
            }

            await db.insert(enrollments).values({
                userId: params.id,
                courseId,
                expiresAt,
                status: 'active'
            });
            return { success: true, message: 'Enrollment added' };
        } catch (error) {
            console.error('Add enrollment error:', error);
            return fail(500, { message: 'Failed to enroll user' });
        }
    },

    removeEnrollment: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const courseId = data.get('courseId') as string;

        if (!courseId) return fail(400, { message: 'Missing course ID' });

        try {
            const targetUser = await db.query.user.findFirst({ where: eq(user.id, params.id) });
            const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });

            await db.delete(enrollments).where(and(
                eq(enrollments.userId, params.id),
                eq(enrollments.courseId, courseId)
            ));

            if (targetUser && course) {
                await sendMail({
                    to: targetUser.email,
                    subject: `Kurszugang beendet: ${course.title}`,
                    html: enrollmentRevokedEmail({ name: targetUser.name, courseTitle: course.title, reason: 'manual' }),
                });
            }

            return { success: true, message: 'Enrollment removed' };
        } catch (error) {
            console.error('Remove enrollment error:', error);
            return fail(500, { message: 'Failed to remove enrollment' });
        }
    },

    updateEnrollment: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const courseId = data.get('courseId') as string;
        const status = data.get('status') as 'active' | 'expired' | 'cancelled';
        const expiresAtStr = data.get('expiresAt') as string;

        if (!courseId) return fail(400, { message: 'Missing course ID' });

        try {
            await db.update(enrollments)
                .set({ 
                    status, 
                    expiresAt: expiresAtStr ? new Date(expiresAtStr) : null 
                })
                .where(and(
                    eq(enrollments.userId, params.id),
                    eq(enrollments.courseId, courseId)
                ));
            return { success: true, message: 'Enrollment updated' };
        } catch (error) {
            console.error('Update enrollment error:', error);
            return fail(500, { message: 'Failed to update enrollment' });
        }
    },

    refundPurchase: async ({ request, params, locals }) => {
        if (!locals.user) return fail(401);
        const data = await request.formData();
        const purchaseId = data.get('purchaseId') as string;

        if (!purchaseId) return fail(400, { message: 'Missing purchase ID' });

        try {
            await db.update(purchases)
                .set({ status: 'refunded' })
                .where(eq(purchases.id, purchaseId));

            return { success: true, message: 'Purchase marked as refunded' };
        } catch (error) {
            console.error('Refund error:', error);
            return fail(500, { message: 'Failed to refund purchase' });
        }
    },

    deleteUser: async ({ params, locals }) => {
        if (!locals.user) return fail(401);
        const targetId = params.id;

        // Prevent self-deletion
        if (locals.user.id === targetId) return fail(400, { message: 'Cannot delete your own account' });

        try {
            // Delete dependent records first
            await db.delete(enrollments).where(eq(enrollments.userId, targetId));
            await db.delete(purchases).where(eq(purchases.userId, targetId));
            await db.delete(communityPosts).where(eq(communityPosts.authorId, targetId));
            await db.delete(user).where(eq(user.id, targetId));
        } catch (error) {
            console.error('Delete user error:', error);
            return fail(500, { message: 'Failed to delete user' });
        }

        throw redirect(302, '/admin/users');
    }
};
