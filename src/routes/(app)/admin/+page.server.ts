import { db } from '$lib/server/db';
import { courses, enrollments, user, purchases, invoices } from '$lib/server/db/schema';
import { count, desc, sum, eq, and, sql, isNotNull, isNull, lt, min } from 'drizzle-orm';
import { fail, type Actions } from '@sveltejs/kit';
import { stripe } from '$lib/server/stripe';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    // 1. Total Courses
    const [coursesCount] = await db.select({ value: count() }).from(courses);

    // 2. Total Students (users with role 'student' or just total users for now)
    // Let's count total users for simplicity
    const [usersCount] = await db.select({ value: count() }).from(user);

    // 3. Total Enrollments
    const [enrollmentsCount] = await db.select({ value: count() }).from(enrollments);

    // 4. Recent Enrollments
    const recentEnrollments = await db.query.enrollments.findMany({
        orderBy: [desc(enrollments.enrolledAt)],
        limit: 5,
        with: {
            user: true,
            course: true
        }
    });

    // 5. Total Revenue.
    // Since the invoicing rework every payment and refund has exactly one document with a payment
    // reference, so revenue = sum of those (corrections are negative). Older data is counted the
    // previous way (purchases + subscription renewals) up to the first new-style invoice.
    const [newRevenue] = await db.select({ value: sum(invoices.totalCents), since: min(invoices.createdAt) })
        .from(invoices)
        .where(isNotNull(invoices.paymentReference));
    const cutover = newRevenue.since ?? new Date();

    const [purchaseRevenueResult] = await db.select({
        value: sum(purchases.amount)
    })
    .from(purchases)
    .where(and(eq(purchases.status, 'completed'), lt(purchases.createdAt, cutover)));

    const [subRevenueResult] = await db.select({
        value: sum(invoices.totalCents)
    })
    .from(invoices)
    .where(and(eq(invoices.type, 'subscription'), isNull(invoices.paymentReference), lt(invoices.createdAt, cutover)));

    const totalRevenueResult = {
        value: Number(newRevenue.value ?? 0) + Number(purchaseRevenueResult.value ?? 0) + Number(subRevenueResult.value ?? 0)
    };

    // 6. Total Refunds
    const [totalRefundsResult] = await db.select({ value: count() })
        .from(purchases)
        .where(eq(purchases.status, 'refunded'));

    // 7. Recent Purchases (For the management table)
    const recentPurchases = await db.query.purchases.findMany({
        orderBy: [desc(purchases.createdAt)],
        limit: 50,
        with: {
            user: true,
            course: true
        }
    });
    
    // 8. Monthly Revenue for Chart — last 12 months, zero-filled
    const now = new Date();
    // Build array of last 12 months as 'YYYY-MM' strings (oldest → newest)
    const last12Months: string[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        last12Months.push(`${yyyy}-${mm}`);
    }

    const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const rawMonthly = await db.select({
        month: sql<string>`to_char(${purchases.createdAt}, 'YYYY-MM')`,
        revenue: sum(purchases.amount).mapWith(Number)
    })
    .from(purchases)
    .where(and(
        eq(purchases.status, 'completed'),
        sql`${purchases.createdAt} >= ${cutoff.toISOString()}`
    ))
    .groupBy(sql`to_char(${purchases.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${purchases.createdAt}, 'YYYY-MM')`);

    // Also aggregate subscription invoice revenue per month
    const rawSubMonthly = await db.select({
        month: sql<string>`to_char(${invoices.invoiceDate}, 'YYYY-MM')`,
        revenue: sum(invoices.totalCents).mapWith(Number)
    })
    .from(invoices)
    .where(and(
        eq(invoices.type, 'subscription'),
        sql`${invoices.invoiceDate} >= ${cutoff.toISOString()}`
    ))
    .groupBy(sql`to_char(${invoices.invoiceDate}, 'YYYY-MM')`);

    const subRevenueMap = new Map(rawSubMonthly.map(r => [r.month, r.revenue]));
    const revenueMap = new Map(rawMonthly.map(r => [r.month, r.revenue]));

    const monthlyRevenue = last12Months.map(month => ({
        month,
        revenue: (revenueMap.get(month) ?? 0) + (subRevenueMap.get(month) ?? 0),
    }));

    return {
        stats: {
            totalCourses: coursesCount.value,
            totalUsers: usersCount.value,
            totalEnrollments: enrollmentsCount.value,
            totalRevenue: totalRevenueResult.value,
            totalRefunds: totalRefundsResult.value
        },
        recentEnrollments,
        recentPurchases,
        monthlyRevenue
    };
};

export const actions: Actions = {
    refundPurchase: async ({ request }) => {
        const formData = await request.formData();
        const purchaseId = formData.get('purchaseId') as string;

        if (!purchaseId) {
            return fail(400, { message: 'Purchase ID is required' });
        }

        try {
            // 1. Get the purchase details
            const purchase = await db.query.purchases.findFirst({
                where: eq(purchases.id, purchaseId)
            });

            if (!purchase) {
                return fail(404, { message: 'Purchase not found' });
            }

            if (purchase.status === 'refunded') {
                return fail(400, { message: 'Purchase is already refunded' });
            }

            // 2. Process refund in Stripe
            // We use the checkout session to find the payment intent
            const session = await stripe.checkout.sessions.retrieve(purchase.stripeCheckoutSessionId);
            
            if (session.payment_intent) {
                await stripe.refunds.create({
                    payment_intent: session.payment_intent as string,
                });
            } else {
                 return fail(400, { message: 'No payment intent found for this session.' });
            }

            // 3. Update DB Purchase Status
            await db.update(purchases)
                .set({ status: 'refunded' })
                .where(eq(purchases.id, purchaseId));

            // 4. Cancel the User's Enrollment
            await db.update(enrollments)
                .set({ status: 'cancelled' })
                .where(and(
                    eq(enrollments.userId, purchase.userId),
                    eq(enrollments.courseId, purchase.courseId)
                ));

            return { success: true };
        } catch (e: any) {
            console.error('Error refunding purchase:', e);
            return fail(500, { message: e.message || 'Failed to process refund' });
        }
    }
};
