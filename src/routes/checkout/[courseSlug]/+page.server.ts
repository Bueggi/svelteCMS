import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { courses, upsells, enrollments } from '$lib/server/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getEnabledPaymentMethods, getPayPalConfig, getVatConfig, getTaxRates } from '$lib/server/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { courseSlug } = params;

    const course = await db.query.courses.findFirst({
        where: eq(courses.slug, courseSlug)
    });

    if (!course) throw error(404, 'Course not found');
    if (!course.isPublished) throw error(404, 'Course not found');

    // Check if already enrolled
    if (locals.user) {
        const existing = await db.query.enrollments.findFirst({
            where: and(
                eq(enrollments.userId, locals.user.id),
                eq(enrollments.courseId, course.id)
            )
        });
        if (existing?.status === 'active') {
            throw redirect(302, `/courses/${courseSlug}/learn`);
        }
    }

    // Load active upsells for this course
    const courseUpsells = await db.query.upsells.findMany({
        where: and(
            eq(upsells.sourceCourseId, course.id),
            eq(upsells.isActive, true)
        ),
        with: {
            upsellCourse: true
        },
        orderBy: [asc(upsells.order)]
    });

    const [enabledMethods, paypalConfig, vatConfig, allTaxRates] = await Promise.all([
        getEnabledPaymentMethods(),
        getPayPalConfig(),
        getVatConfig(),
        getTaxRates(),
    ]);

    return {
        course,
        upsells: courseUpsells,
        user: locals.user,
        enabledMethods,
        paypalClientId: paypalConfig?.clientId ?? null,
        vatRate: vatConfig.vatRate,
        reverseChargeEnabled: vatConfig.reverseChargeEnabled,
        operatorCountry: vatConfig.companyCountry,
        taxRates: allTaxRates,
    };
};
