import { json, error } from '@sveltejs/kit';
import { getPayPalConfig } from '$lib/server/settings';
import { capturePayPalOrder } from '$lib/server/paypal';
import { db } from '$lib/server/db';
import { courses, upsells, purchases, enrollments, user } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { sendMail } from '$lib/server/email/mailer';
import { enrollmentConfirmEmail } from '$lib/server/email/templates';
import type { RequestHandler } from './$types';
import { fireAutomations } from '$lib/server/automations';

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json() as { orderId: string; courseId: string; upsellIds?: string[] };
	const { orderId, courseId, upsellIds = [] } = body;
	if (!orderId || !courseId) return error(400, 'orderId and courseId required');

	const config = await getPayPalConfig();
	if (!config) return error(500, 'PayPal not configured');

	let capture: any;
	try {
		capture = await capturePayPalOrder(config, orderId);
	} catch (err: any) {
		console.error('PayPal capture error:', err);
		return error(500, 'PayPal capture failed');
	}

	const captureStatus = capture?.status;
	if (captureStatus !== 'COMPLETED') {
		return error(400, `PayPal capture status: ${captureStatus}`);
	}

	const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
	if (!course) return error(404, 'Course not found');

	// Build list of all course IDs in this purchase
	const allCourseIds = [courseId];
	let totalAmount = course.price;

	if (upsellIds.length > 0) {
		const courseUpsells = await db.query.upsells.findMany({
			where: and(eq(upsells.sourceCourseId, courseId), eq(upsells.isActive, true), inArray(upsells.id, upsellIds)),
			with: { upsellCourse: true },
		});
		for (const u of courseUpsells) {
			allCourseIds.push(u.upsellCourseId);
			totalAmount += u.discountPercent > 0 ? Math.round(u.upsellCourse.price * (1 - u.discountPercent / 100)) : u.upsellCourse.price;
		}
	}

	// Resolve or create user
	let userId = locals.user?.id;
	const payerEmail = capture?.payment_source?.paypal?.email_address || capture?.payer?.email_address;
	const payerName = capture?.payment_source?.paypal?.name?.given_name || 'Student';

	if (!userId && payerEmail) {
		const existing = await db.query.user.findFirst({ where: eq(user.email, payerEmail) });
		if (existing) {
			userId = existing.id;
		} else {
			userId = crypto.randomUUID();
			await db.insert(user).values({ id: userId, email: payerEmail, name: payerName, emailVerified: false, role: 'student', createdAt: new Date(), updatedAt: new Date() });
		}
	}

	if (!userId) return error(400, 'Could not determine user');

	const buyer = await db.query.user.findFirst({ where: eq(user.id, userId) });
	const perCourse = allCourseIds.length > 1 ? Math.floor(totalAmount / allCourseIds.length) : totalAmount;

	for (let i = 0; i < allCourseIds.length; i++) {
		const cId = allCourseIds[i];
		const amount = i === 0 ? totalAmount - perCourse * (allCourseIds.length - 1) : perCourse;
		const sessionId = i === 0 ? `paypal_${orderId}` : `paypal_${orderId}_${i}`;

		try {
			await db.insert(purchases).values({ userId, courseId: cId, stripeCheckoutSessionId: sessionId, amount, status: 'completed', paymentProvider: 'paypal' }).onConflictDoNothing();
			await db.insert(enrollments).values({ userId, courseId: cId, status: 'active' }).onConflictDoNothing();

			if (buyer) {
				const c = await db.query.courses.findFirst({ where: eq(courses.id, cId) });
				if (c) {
					await sendMail({ to: buyer.email, subject: `Kauf bestätigt: ${c.title}`, html: enrollmentConfirmEmail({ name: buyer.name, courseTitle: c.title, courseSlug: c.slug, amount }) });
					const eventData = {
						user: { id: buyer.id, email: buyer.email, name: buyer.name, createdAt: (buyer.createdAt as Date)?.toISOString() },
						course: { id: c.id, title: c.title, slug: c.slug },
						purchase: { id: sessionId, amount, createdAt: new Date().toISOString() },
					};
					fireAutomations('purchase.completed', eventData);
					fireAutomations('enrollment.created', {
						...eventData,
						enrollment: { id: `enr_${userId}_${cId}`, enrolledAt: new Date().toISOString() },
					});
				}
			}
		} catch (err) {
			console.error(`Error processing PayPal course ${cId}:`, err);
		}
	}

	return json({ success: true, courseSlug: course.slug });
};
