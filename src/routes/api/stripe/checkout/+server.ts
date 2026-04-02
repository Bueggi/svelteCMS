import { json, error } from '@sveltejs/kit';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey, getStripeTestKey, getEnabledPaymentMethods, getVatConfig, getTaxRateForCountry, getSettings } from '$lib/server/settings';
import { db } from '$lib/server/db';
import { courses, coupons, upsells, funnels, funnelBumps } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

export const POST: RequestHandler = async ({ request, locals }) => {
    const body = await request.json() as {
        courseId: string;
        upsellIds?: string[];
        couponCode?: string;
        selectedMethod?: string;
        reverseCharge?: boolean;
        billingAddress?: {
            name: string;
            email?: string;
            street: string;
            zip: string;
            city: string;
            country: string;
            vatId?: string;
        };
        funnelSlug?: string;
        bumpCourseIds?: string[];
        sandboxMode?: boolean;
        legalChecks?: string[];
    };

    const { courseId, upsellIds = [], couponCode, selectedMethod, reverseCharge = false, billingAddress, funnelSlug, bumpCourseIds = [], sandboxMode = false, legalChecks = [] } = body;

    if (!courseId) {
        return error(400, 'Course ID is required');
    }

    const billingCountry = billingAddress?.country?.toUpperCase();

    const [stripeKey, stripeTestKey, vatConfig, countrySpecificRate, siteSettings] = await Promise.all([
        getStripeKey(),
        getStripeTestKey(),
        getVatConfig(),
        billingCountry ? getTaxRateForCountry(billingCountry) : Promise.resolve(null),
        getSettings(),
    ]);

    const PUBLIC_BASE_URL = siteSettings?.siteUrl || env.PUBLIC_BASE_URL || 'http://localhost:5173';

    const activeKey = sandboxMode ? stripeTestKey : stripeKey;
    if (!activeKey) return error(500, sandboxMode ? 'Stripe Test Key ist nicht konfiguriert. Bitte unter Einstellungen → Integrationen hinterlegen.' : 'Stripe is not configured');
    const stripe = getStripeClient(activeKey);

    // Country-specific rate takes priority over global default
    const effectiveVatRate = countrySpecificRate ?? vatConfig.vatRate;

    // If reverse charge applies, charge net price (remove VAT)
    const toChargeAmount = (grossAmount: number) =>
        reverseCharge && effectiveVatRate > 0
            ? Math.round(grossAmount / (1 + effectiveVatRate / 100))
            : grossAmount;

    const course = await db.query.courses.findFirst({
        where: eq(courses.id, courseId)
    });

    if (!course) {
        return error(404, 'Course not found');
    }

    // Resolve upsell courses
    let upsellItems: Array<{ course: typeof course; discountedPrice: number }> = [];

    if (upsellIds.length > 0) {
        const courseUpsells = await db.query.upsells.findMany({
            where: and(
                eq(upsells.sourceCourseId, courseId),
                eq(upsells.isActive, true),
                inArray(upsells.id, upsellIds)
            ),
            with: { upsellCourse: true }
        });

        upsellItems = courseUpsells.map(u => ({
            course: u.upsellCourse,
            discountedPrice: u.discountPercent > 0
                ? Math.round(u.upsellCourse.price * (1 - u.discountPercent / 100))
                : u.upsellCourse.price
        }));
    }

    // Handle funnel order bumps
    let bumpItems: Array<{ course: typeof course; price: number }> = [];
    let funnelData: Awaited<ReturnType<typeof db.query.funnels.findFirst>> | null = null;

    if (funnelSlug) {
        funnelData = await db.query.funnels.findFirst({
            where: eq(funnels.slug, funnelSlug),
            with: {
                bumps: { with: { course: true } },
                upsells: { orderBy: (u, { asc }) => [asc(u.order)] },
            },
        }) ?? null;

        if (funnelData && bumpCourseIds.length > 0) {
            for (const bumpCourseId of bumpCourseIds) {
                const bump = (funnelData as any).bumps?.find((b: any) => b.courseId === bumpCourseId);
                if (bump?.course) {
                    bumpItems.push({ course: bump.course, price: bump.specialPrice ?? bump.course.price });
                }
            }
        }
    }

    // Build metadata: all courseIds as comma-separated list
    const allCourseIds = [courseId, ...upsellItems.map(u => u.course.id), ...bumpItems.map(b => b.course.id)].join(',');

    // Handle coupon
    let stripeCouponId: string | undefined;

    if (couponCode) {
        const uppercaseCode = couponCode.trim().toUpperCase();
        const validCoupon = await db.query.coupons.findFirst({
            where: eq(coupons.code, uppercaseCode)
        });

        if (!validCoupon) return error(400, 'Invalid coupon code');
        if (!validCoupon.isActive) return error(400, 'This coupon is no longer active');
        if (validCoupon.expiresAt && new Date(validCoupon.expiresAt) < new Date()) {
            return error(400, 'This coupon has expired');
        }
        if (validCoupon.applicableTo === 'specific' && validCoupon.courseId !== course.id) {
            return error(400, 'This coupon cannot be applied to this course');
        }

        try {
            const stripeCoupon = await stripe.coupons.create({
                name: validCoupon.code,
                duration: 'once',
                percent_off: validCoupon.discountType === 'percentage' ? validCoupon.discountValue : undefined,
                amount_off: validCoupon.discountType === 'amount' ? validCoupon.discountValue : undefined,
                currency: validCoupon.discountType === 'amount' ? 'eur' : undefined,
            });
            stripeCouponId = stripeCoupon.id;
        } catch (stripeErr: any) {
            console.error('Failed to create Stripe coupon:', stripeErr);
            return error(500, 'Failed to process coupon');
        }
    }

    const isSubscription = course.accessType === 'subscription';
    const stripeInterval = course.subscriptionInterval ?? 'month';

    // Build line items — apply reverse charge adjustment if needed
    const lineItems = isSubscription
        ? [
            {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: course.title,
                        description: course.subtitle || undefined,
                        images: course.thumbnailUrl ? [course.thumbnailUrl] : undefined,
                    },
                    unit_amount: toChargeAmount(course.price),
                    recurring: { interval: stripeInterval as 'month' | 'year' },
                },
                quantity: 1,
            },
        ]
        : [
            {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: course.title,
                        description: course.subtitle || undefined,
                        images: course.thumbnailUrl ? [course.thumbnailUrl] : undefined,
                    },
                    unit_amount: toChargeAmount(course.price),
                },
                quantity: 1,
            },
            ...upsellItems.map(u => ({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: u.course.title,
                        description: u.course.subtitle || undefined,
                        images: u.course.thumbnailUrl ? [u.course.thumbnailUrl] : undefined,
                    },
                    unit_amount: toChargeAmount(u.discountedPrice),
                },
                quantity: 1,
            })),
            ...bumpItems.map(b => ({
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: b.course.title,
                        description: b.course.subtitle || undefined,
                        images: b.course.thumbnailUrl ? [b.course.thumbnailUrl] : undefined,
                    },
                    unit_amount: toChargeAmount(b.price),
                },
                quantity: 1,
            })),
        ];

    // success_url — funnel flow goes to first upsell or funnel thank-you; otherwise default thank-you
    let successUrl: string;
    if (funnelSlug && funnelData) {
        const firstUpsell = (funnelData as any).upsells?.[0] ?? null;
        successUrl = firstUpsell
            ? `${PUBLIC_BASE_URL}/f/${funnelSlug}/u/${firstUpsell.id}?session_id={CHECKOUT_SESSION_ID}`
            : `${PUBLIC_BASE_URL}/f/${funnelSlug}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
    } else {
        successUrl = `${PUBLIC_BASE_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}&course=${course.slug}`;
    }
    const cancelUrl = `${PUBLIC_BASE_URL}/checkout/${course.slug}?canceled=true`;

    // Determine Stripe payment methods
    const STRIPE_VALID_METHODS = ['card', 'sepa_debit', 'klarna', 'link', 'sofort'];
    let stripeMethods: string[];
    if (selectedMethod && STRIPE_VALID_METHODS.includes(selectedMethod)) {
        // User explicitly selected a specific payment method
        stripeMethods = [selectedMethod];
    } else {
        const allMethods = await getEnabledPaymentMethods();
        stripeMethods = allMethods.filter(m => STRIPE_VALID_METHODS.includes(m));
        if (!stripeMethods.includes('card')) stripeMethods.unshift('card');
    }

    const sharedMetadata = {
        userId: locals.user?.id || '',
        courseId: course.id,
        courseIds: allCourseIds,
        isGuest: locals.user ? 'false' : 'true',
        reverseCharge: reverseCharge ? 'true' : 'false',
        billingName: billingAddress?.name || '',
        billingEmail: billingAddress?.email || '',
        billingStreet: billingAddress?.street || '',
        billingZip: billingAddress?.zip || '',
        billingCity: billingAddress?.city || '',
        billingCountry: billingAddress?.country || '',
        billingVatId: billingAddress?.vatId || '',
        // Stripe metadata values must be strings ≤500 chars each
        legalChecks: legalChecks.length > 0 ? JSON.stringify(legalChecks).slice(0, 500) : '',
    };

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: stripeMethods as any,
            line_items: lineItems,
            mode: isSubscription ? 'subscription' : 'payment',
            ...(isSubscription ? {
                subscription_data: {
                    metadata: sharedMetadata,
                    ...(course.trialDays && course.trialDays > 0 ? { trial_period_days: course.trialDays } : {}),
                },
            } : {
                invoice_creation: { enabled: true },
                discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
                allow_promotion_codes: stripeCouponId ? undefined : true,
            }),
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: locals.user?.email || billingAddress?.email || undefined,
            client_reference_id: locals.user?.id,
            metadata: sharedMetadata,
            billing_address_collection: 'auto',
            customer_creation: locals.user ? undefined : 'if_required',
        });

        return json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Checkout Error:', err);
        return error(500, err.message);
    }
};
