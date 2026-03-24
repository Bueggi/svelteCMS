import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getInvoicesForUser } from '$lib/server/invoices';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) throw redirect(302, '/login');

    const [userPurchases, subscriptionEnrollments, invoiceList] = await Promise.all([
        db.query.purchases.findMany({
            where: (p, { eq }) => eq(p.userId, locals.user!.id),
            with: { course: true },
            orderBy: (p, { desc }) => [desc(p.createdAt)],
        }),
        db.query.enrollments.findMany({
            where: (e, { eq, and, isNotNull }) => and(
                eq(e.userId, locals.user!.id),
                isNotNull(e.stripeSubscriptionId),
            ),
            with: { course: true },
        }),
        getInvoicesForUser(locals.user.id),
    ]);

    return {
        user: locals.user,
        purchases: userPurchases,
        subscriptions: subscriptionEnrollments,
        invoiceList,
    };
};
