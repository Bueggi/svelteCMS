import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { courses, reviews, enrollments, upsells } from '$lib/server/db/schema';
import { eq, and, desc, avg, count, asc } from 'drizzle-orm';
import { getEnabledPaymentMethods, getPayPalConfig, getVatConfig, getTaxRates } from '$lib/server/settings';
import type { PageServerLoad, Actions } from './$types';
import { hasActiveAccess } from '$lib/server/access';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { slug } = params;

    const course = await db.query.courses.findFirst({
        where: eq(courses.slug, slug),
        with: {
            instructor: true,
            modules: {
                orderBy: (modules, { asc }) => [asc(modules.order)],
                with: {
                    lessons: {
                        orderBy: (lessons, { asc }) => [asc(lessons.order)]
                    }
                }
            }
        }
    });

    if (!course) error(404, 'Course not found');

    // Load reviews with user info
    const courseReviews = await db.query.reviews.findMany({
        where: eq(reviews.courseId, course.id),
        with: { user: { columns: { name: true, image: true } } },
        orderBy: [desc(reviews.createdAt)],
        limit: 20,
    });

    // Aggregate rating
    const [ratingData] = await db.select({
        avgRating: avg(reviews.rating),
        totalReviews: count(reviews.rating),
    }).from(reviews).where(eq(reviews.courseId, course.id));

    // Check if current user is enrolled (to show review form)
    let isEnrolled = false;
    let userReview = null;
    if (locals.user) {
        const enrollment = await db.query.enrollments.findFirst({
            where: and(eq(enrollments.userId, locals.user.id), eq(enrollments.courseId, course.id))
        });
        isEnrolled = hasActiveAccess(enrollment);

        userReview = await db.query.reviews.findFirst({
            where: and(eq(reviews.userId, locals.user.id), eq(reviews.courseId, course.id))
        });
    }

    // Load upsells for embedded checkout block
    const courseUpsells = await db.query.upsells.findMany({
        where: and(eq(upsells.sourceCourseId, course.id), eq(upsells.isActive, true)),
        with: { upsellCourse: true },
        orderBy: [asc(upsells.order)],
    });

    const [enabledMethods, paypalConfig, vatConfig, allTaxRates] = await Promise.all([
        getEnabledPaymentMethods(),
        getPayPalConfig(),
        getVatConfig(),
        getTaxRates(),
    ]);

    return {
        course,
        courseReviews,
        avgRating: ratingData?.avgRating ? parseFloat(ratingData.avgRating as string) : null,
        totalReviews: ratingData?.totalReviews ?? 0,
        isEnrolled,
        userReview,
        courseUpsells,
        enabledMethods,
        paypalClientId: paypalConfig?.clientId ?? null,
        vatRate: vatConfig.vatRate,
        reverseChargeEnabled: vatConfig.reverseChargeEnabled,
        operatorCountry: vatConfig.companyCountry,
        taxRates: allTaxRates,
    };
};

export const actions: Actions = {
    submitReview: async ({ request, locals, params }) => {
        if (!locals.user) return fail(401, { message: 'Login required' });

        const data = await request.formData();
        const rating = parseInt(data.get('rating') as string);
        const body = (data.get('body') as string)?.trim() || null;

        if (!rating || rating < 1 || rating > 5) return fail(400, { message: 'Rating must be 1–5' });

        const course = await db.query.courses.findFirst({ where: eq(courses.slug, params.slug) });
        if (!course) return fail(404, { message: 'Course not found' });

        const enrollment = await db.query.enrollments.findFirst({
            where: and(eq(enrollments.userId, locals.user.id), eq(enrollments.courseId, course.id))
        });
        if (!enrollment) return fail(403, { message: 'You must be enrolled to leave a review' });

        await db.insert(reviews).values({
            userId: locals.user.id,
            courseId: course.id,
            rating,
            body,
            updatedAt: new Date(),
        }).onConflictDoUpdate({
            target: [reviews.userId, reviews.courseId],
            set: { rating, body, updatedAt: new Date() }
        });

        return { success: true };
    }
};
