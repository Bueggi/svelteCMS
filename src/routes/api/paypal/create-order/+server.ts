import { json, error } from '@sveltejs/kit';
import { getPayPalConfig } from '$lib/server/settings';
import { createPayPalOrder } from '$lib/server/paypal';
import { db } from '$lib/server/db';
import { courses, upsells } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json() as { courseId: string; upsellIds?: string[] };
	const { courseId, upsellIds = [] } = body;
	if (!courseId) return error(400, 'courseId required');

	const config = await getPayPalConfig();
	if (!config) return error(500, 'PayPal not configured');

	const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
	if (!course) return error(404, 'Course not found');

	const items: Array<{ name: string; amount: number }> = [{ name: course.title, amount: course.price }];

	if (upsellIds.length > 0) {
		const courseUpsells = await db.query.upsells.findMany({
			where: and(eq(upsells.sourceCourseId, courseId), eq(upsells.isActive, true), inArray(upsells.id, upsellIds)),
			with: { upsellCourse: true },
		});
		for (const u of courseUpsells) {
			const price = u.discountPercent > 0 ? Math.round(u.upsellCourse.price * (1 - u.discountPercent / 100)) : u.upsellCourse.price;
			items.push({ name: u.upsellCourse.title, amount: price });
		}
	}

	try {
		const order = await createPayPalOrder(config, items);
		return json({ id: order.id });
	} catch (err: any) {
		console.error('PayPal create order error:', err);
		return error(500, err.message);
	}
};
