import { db } from '$lib/server/db';
import { coupons, courses } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const allCoupons = await db.query.coupons.findMany({
        orderBy: [desc(coupons.createdAt)],
        with: {
            course: true,
        }
    });

    const allCourses = await db.query.courses.findMany({
        orderBy: [desc(courses.createdAt)],
    });

    return {
        coupons: allCoupons,
        courses: allCourses
    };
};

export const actions: Actions = {
    createCoupon: async ({ request }) => {
        const formData = await request.formData();
        const code = formData.get('code')?.toString()?.trim().toUpperCase();
        const discountType = formData.get('discountType')?.toString() as 'percentage' | 'amount';
        const discountValueRaw = formData.get('discountValue')?.toString();
        const applicableTo = formData.get('applicableTo')?.toString() as 'all' | 'specific';
        const courseIdRaw = formData.get('courseId')?.toString();
        const expiresAtRaw = formData.get('expiresAt')?.toString();

        if (!code) return fail(400, { message: 'Code is required' });
        if (!discountValueRaw) return fail(400, { message: 'Discount value is required' });

        let discountValue = parseInt(discountValueRaw);
        if (isNaN(discountValue)) return fail(400, { message: 'Invalid discount value' });

        if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
            return fail(400, { message: 'Percentage must be between 1 and 100' });
        }
        if (discountType === 'amount' && discountValue < 0) {
            return fail(400, { message: 'Amount cannot be negative' });
        }

        let courseId: string | null = null;
        if (applicableTo === 'specific') {
            if (!courseIdRaw || courseIdRaw === 'null') {
                return fail(400, { message: 'Course must be selected for specific applicability' });
            }
            courseId = courseIdRaw;
        }

        let expiresAt: Date | null = null;
        if (expiresAtRaw) {
            const parsedDate = new Date(expiresAtRaw);
            if (isNaN(parsedDate.getTime())) {
                return fail(400, { message: 'Invalid expiration date format' });
            }
            expiresAt = parsedDate;
        }

        try {
            await db.insert(coupons).values({
                code,
                discountType,
                discountValue,
                applicableTo,
                courseId,
                expiresAt,
                isActive: true
            });
            return { success: true };
        } catch (e: any) {
            console.error('Error creating coupon:', e);
            if (e.code === '23505') { // Postgres unique constraint violation
                return fail(400, { message: 'Coupon code already exists' });
            }
            return fail(500, { message: 'Failed to create coupon' });
        }
    },
    deleteCoupon: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id');

        if (!id || typeof id !== 'string') {
            return fail(400, { message: 'Missing coupon ID' });
        }

        try {
            await db.delete(coupons).where(eq(coupons.id, id));
            return { success: true };
        } catch (e) {
            console.error(e);
            return fail(500, { message: 'Failed to delete coupon' });
        }
    },
    toggleCouponStatus: async ({ request }) => {
        const formData = await request.formData();
        const id = formData.get('id');

        if (!id || typeof id !== 'string') {
            return fail(400, { message: 'Missing coupon ID' });
        }

        try {
            const coupon = await db.query.coupons.findFirst({
                where: eq(coupons.id, id)
            });

            if (!coupon) return fail(404, { message: 'Coupon not found' });

            await db.update(coupons)
                .set({ isActive: !coupon.isActive })
                .where(eq(coupons.id, id));
                
            return { success: true };
        } catch (e) {
            console.error(e);
            return fail(500, { message: 'Failed to toggle coupon status' });
        }
    }
};
