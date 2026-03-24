import { db } from '$lib/server/db';
import { purchases, user as userTable, courses, enrollments } from '$lib/server/db/schema';
import { desc, eq, or, ilike, and, count } from 'drizzle-orm';
import { fail, type Actions } from '@sveltejs/kit';
import { stripe } from '$lib/server/stripe';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({ url }) => {
    const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
    const status = url.searchParams.get('status') || '';
    const search = url.searchParams.get('search') || '';

    const conditions = [];
    if (status && ['completed', 'refunded', 'disputed'].includes(status)) {
        conditions.push(eq(purchases.status, status as 'completed' | 'refunded' | 'disputed'));
    }
    if (search) {
        conditions.push(
            or(
                ilike(userTable.name, `%${search}%`),
                ilike(userTable.email, `%${search}%`),
                ilike(courses.title, `%${search}%`)
            )
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
        .select({ total: count() })
        .from(purchases)
        .leftJoin(userTable, eq(purchases.userId, userTable.id))
        .leftJoin(courses, eq(purchases.courseId, courses.id))
        .where(whereClause);

    const results = await db
        .select({
            id: purchases.id,
            amount: purchases.amount,
            status: purchases.status,
            createdAt: purchases.createdAt,
            stripeCheckoutSessionId: purchases.stripeCheckoutSessionId,
            user: {
                id: userTable.id,
                name: userTable.name,
                email: userTable.email,
                stripeCustomerId: userTable.stripeCustomerId,
            },
            course: {
                id: courses.id,
                title: courses.title,
                slug: courses.slug,
                accessType: courses.accessType,
            },
        })
        .from(purchases)
        .leftJoin(userTable, eq(purchases.userId, userTable.id))
        .leftJoin(courses, eq(purchases.courseId, courses.id))
        .where(whereClause)
        .orderBy(desc(purchases.createdAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE);

    return {
        purchases: results,
        pagination: {
            page,
            totalPages: Math.ceil(total / PAGE_SIZE),
            totalCount: total,
        },
        filters: { status, search },
    };
};

export const actions: Actions = {
    refundPurchase: async ({ request }) => {
        const formData = await request.formData();
        const purchaseId = formData.get('purchaseId') as string;

        if (!purchaseId) return fail(400, { message: 'Purchase ID is required' });

        try {
            const purchase = await db.query.purchases.findFirst({
                where: eq(purchases.id, purchaseId),
            });

            if (!purchase) return fail(404, { message: 'Purchase not found' });
            if (purchase.status === 'refunded') return fail(400, { message: 'Already refunded' });

            const session = await stripe.checkout.sessions.retrieve(
                purchase.stripeCheckoutSessionId
            );

            if (!session.payment_intent) {
                return fail(400, { message: 'No payment intent found for this session' });
            }

            await stripe.refunds.create({
                payment_intent: session.payment_intent as string,
            });

            await db
                .update(purchases)
                .set({ status: 'refunded' })
                .where(eq(purchases.id, purchaseId));

            await db
                .update(enrollments)
                .set({ status: 'cancelled' })
                .where(
                    and(
                        eq(enrollments.userId, purchase.userId),
                        eq(enrollments.courseId, purchase.courseId)
                    )
                );

            return { success: true };
        } catch (e: any) {
            console.error('Refund error:', e);
            return fail(500, { message: e.message || 'Failed to process refund' });
        }
    },
};
