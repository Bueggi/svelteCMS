import { json, error } from '@sveltejs/kit';
import { getPayPalConfig, getTaxContext } from '$lib/server/settings';
import { issueInvoice, sendInvoiceEmail } from '$lib/server/invoices';
import { determineTax } from '$lib/tax';
import { capturePayPalOrder } from '$lib/server/paypal';
import { db } from '$lib/server/db';
import { courses, upsells, purchases, enrollments, user } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { sendMail } from '$lib/server/email/mailer';
import { enrollmentConfirmEmail } from '$lib/server/email/templates';
import type { RequestHandler } from './$types';
import { fireAutomations } from '$lib/server/automations';

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json() as {
		orderId: string;
		courseId: string;
		upsellIds?: string[];
		billingAddress?: { name?: string; email?: string; street?: string; zip?: string; city?: string; country?: string; vatId?: string };
	};
	const { orderId, courseId, upsellIds = [], billingAddress } = body;
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
	const lines = [{ description: course.title, grossCents: course.price }];
	let totalAmount = course.price;

	if (upsellIds.length > 0) {
		const courseUpsells = await db.query.upsells.findMany({
			where: and(eq(upsells.sourceCourseId, courseId), eq(upsells.isActive, true), inArray(upsells.id, upsellIds)),
			with: { upsellCourse: true },
		});
		for (const u of courseUpsells) {
			allCourseIds.push(u.upsellCourseId);
			const price = u.discountPercent > 0 ? Math.round(u.upsellCourse.price * (1 - u.discountPercent / 100)) : u.upsellCourse.price;
			lines.push({ description: u.upsellCourse.title, grossCents: price });
			totalAmount += price;
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
			// Re-purchase after a refund/cancellation must reactivate the existing enrollment
			await db.insert(enrollments).values({ userId, courseId: cId, status: 'active' }).onConflictDoUpdate({
				target: [enrollments.userId, enrollments.courseId],
				set: { status: 'active', expiresAt: null, stripeSubscriptionId: null, installmentsTotal: null, installmentsPaid: 0 },
			});

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

	// ── Invoice: one per capture, for the amount PayPal actually captured ──
	try {
		const captureRecord = capture?.purchase_units?.[0]?.payments?.captures?.[0];
		const capturedCents = Math.round(parseFloat(captureRecord?.amount?.value ?? '0') * 100);
		if (captureRecord?.id && capturedCents > 0) {
			const payerAddress = capture?.payer?.address ?? {};
			const country = (billingAddress?.country || payerAddress.country_code || '').toUpperCase() || undefined;
			const customer = {
				name: billingAddress?.name || [capture?.payer?.name?.given_name, capture?.payer?.name?.surname].filter(Boolean).join(' ') || buyer?.name || '',
				email: billingAddress?.email || payerEmail || buyer?.email || '',
				address: billingAddress?.street || billingAddress?.city
					? { line1: billingAddress.street, postal_code: billingAddress.zip, city: billingAddress.city, country }
					: { line1: payerAddress.address_line_1, postal_code: payerAddress.postal_code, city: payerAddress.admin_area_2, country },
				vatId: billingAddress?.vatId || null,
			};
			// PayPal always charges the gross price, so reverse charge can't apply here
			const tax = determineTax(await getTaxContext(), { country, vatId: customer.vatId, isBusiness: false });
			const diff = capturedCents - totalAmount;
			const invoiceId = await issueInvoice({
				kind: 'invoice',
				type: 'one_time',
				userId,
				purchaseId: (await db.query.purchases.findFirst({ where: eq(purchases.stripeCheckoutSessionId, `paypal_${orderId}`) }))?.id,
				customer,
				taxTreatment: tax.treatment,
				vatRate: tax.rate,
				lines: diff === 0 ? lines : [...lines, { description: diff < 0 ? 'Rabatt' : 'Ausgleichsbetrag', grossCents: diff }],
				currency: (captureRecord.amount?.currency_code ?? 'EUR').toLowerCase(),
				paymentProvider: 'paypal',
				paymentReference: captureRecord.id,
				orderReference: orderId,
				paidAt: captureRecord.create_time ? new Date(captureRecord.create_time) : new Date(),
			});
			await sendInvoiceEmail(invoiceId);
		}
	} catch (err) {
		console.error('Failed to create PayPal invoice:', err);
	}

	return json({ success: true, courseSlug: course.slug });
};
