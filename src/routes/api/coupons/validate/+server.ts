import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { coupons } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    const { code, courseId } = await request.json() as { code: string; courseId: string };

    if (!code?.trim()) return error(400, 'Code fehlt');

    const coupon = await db.query.coupons.findFirst({
        where: eq(coupons.code, code.trim().toUpperCase()),
    });

    if (!coupon) return json({ valid: false, message: 'Ungültiger Gutscheincode' });
    if (!coupon.isActive) return json({ valid: false, message: 'Dieser Gutscheincode ist nicht mehr aktiv' });
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        return json({ valid: false, message: 'Dieser Gutscheincode ist abgelaufen' });
    }
    if (coupon.applicableTo === 'specific' && coupon.courseId !== courseId) {
        return json({ valid: false, message: 'Dieser Code gilt nicht für diesen Kurs' });
    }

    return json({
        valid: true,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
    });
};
