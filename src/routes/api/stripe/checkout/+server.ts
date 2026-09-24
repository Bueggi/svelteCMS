import { json, error } from '@sveltejs/kit';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey, getStripeTestKey, getEnabledPaymentMethods, getTaxContext, getSettings } from '$lib/server/settings';
import { determineTax, chargeableAmount } from '$lib/tax';
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
        paymentPlan?: 'full' | 'installments';
    };

    const { courseId, upsellIds = [], couponCode, selectedMethod, reverseCharge = false, billingAddress, funnelSlug, bumpCourseIds = [], sandboxMode = false, legalChecks = [], paymentPlan = 'full' } = body;

    if (!courseId) {
        return error(400, 'Course ID is required');
    }

    const billingCountry = billingAddress?.country?.toUpperCase();

    const [stripeKey, stripeTestKey, taxContext, siteSettings] = await Promise.all([
        getStripeKey(),
        getStripeTestKey(),
        getTaxContext(),
        getSettings(),
    ]);

    const PUBLIC_BASE_URL = siteSettings?.siteUrl || env.PUBLIC_BASE_URL || 'http://localhost:5173';

    const activeKey = sandboxMode ? stripeTestKey : stripeKey;
    if (!activeKey) return error(500, sandboxMode ? 'Stripe Test Key ist nicht konfiguriert. Bitte unter Einstellungen → Integrationen hinterlegen.' : 'Stripe is not configured');
    const stripe = getStripeClient(activeKey);

    // Determined server-side (the client's reverseCharge flag is only a hint) and passed on in the
    // metadata, so the invoice uses exactly the treatment and rate this payment was charged with.
    const tax = determineTax(taxContext, {
        country: billingCountry,
        vatId: billingAddress?.vatId,
        isBusiness: reverseCharge || !!billingAddress?.vatId,
    });
    const toChargeAmount = (grossAmount: number) => chargeableAmount(grossAmount, taxContext, tax.treatment);

    const course = await db.query.courses.findFirst({
        where: eq(courses.id, courseId)
    });

    if (!course) {
        return error(404, 'Course not found');
    }

    const isSubscription = course.accessType === 'subscription';
    const isInstallments = paymentPlan === 'installments';
    if (isInstallments && !(
        !isSubscription &&
        course.installmentsEnabled &&
        (course.installmentCount ?? 0) >= 2 &&
        (course.installmentAmount ?? 0) > 0
    )) {
        return error(400, 'Ratenzahlung ist für diesen Kurs nicht verfügbar');
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

    // Build metadata: all courseIds as comma-separated list.
    // Plain subscriptions only carry the course itself (add-ons aren't charged there).
    const allCourseIds = isSubscription
        ? courseId
        : [courseId, ...upsellItems.map(u => u.course.id), ...bumpItems.map(b => b.course.id)].join(',');

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
                // Installments: a percentage discount applies to every rate, a fixed amount to the first one
                duration: isInstallments && validCoupon.discountType === 'percentage' ? 'forever' : 'once',
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

    const stripeInterval = course.subscriptionInterval ?? 'month';

    const oneTimeAddOns = [
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

    // Build line items — apply reverse charge adjustment if needed
    const lineItems = isInstallments
        ? [
            // Monthly rate; the webhook cancels the subscription after the last one is paid.
            // Add-ons are one-time items billed with the first rate.
            {
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: `${course.title} (Ratenzahlung, ${course.installmentCount} Raten)`,
                        description: course.subtitle || undefined,
                        images: course.thumbnailUrl ? [course.thumbnailUrl] : undefined,
                    },
                    unit_amount: toChargeAmount(course.installmentAmount!),
                    recurring: { interval: 'month' as const },
                },
                quantity: 1,
            },
            ...oneTimeAddOns,
        ]
        : isSubscription
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
            ...oneTimeAddOns,
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
    // Recurring charges (subscriptions, installments) need a reusable method
    const STRIPE_VALID_METHODS = isSubscription || isInstallments
        ? ['card', 'sepa_debit', 'link']
        : ['card', 'sepa_debit', 'klarna', 'link', 'sofort'];
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
        reverseCharge: tax.treatment === 'reverse_charge' ? 'true' : 'false',
        taxTreatment: tax.treatment,
        taxRate: String(tax.rate),
        billingName: billingAddress?.name || '',
        billingEmail: billingAddress?.email || '',
        billingStreet: billingAddress?.street || '',
        billingZip: billingAddress?.zip || '',
        billingCity: billingAddress?.city || '',
        billingCountry: billingAddress?.country || '',
        billingVatId: billingAddress?.vatId || '',
        // Stripe metadata values must be strings ≤500 chars each
        legalChecks: legalChecks.length > 0 ? JSON.stringify(legalChecks).slice(0, 500) : '',
        paymentPlan: isInstallments ? 'installments' : 'full',
        installmentCount: isInstallments ? String(course.installmentCount) : '',
    };
    const isRecurring = isSubscription || isInstallments;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: stripeMethods as any,
            line_items: lineItems,
            mode: isRecurring ? 'subscription' : 'payment',
            ...(isInstallments ? {
                subscription_data: { metadata: sharedMetadata },
                discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
            } : isSubscription ? {
                subscription_data: {
                    metadata: sharedMetadata,
                    ...(course.trialDays && course.trialDays > 0 ? { trial_period_days: course.trialDays } : {}),
                },
            } : {
                // No Stripe invoice: the platform issues the (only) invoice, avoiding two documents
                // with different numbers for one sale (§ 14c UStG)
                discounts: stripeCouponId ? [{ coupon: stripeCouponId }] : undefined,
                allow_promotion_codes: stripeCouponId ? undefined : true,
            }),
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: locals.user?.email || billingAddress?.email || undefined,
            client_reference_id: locals.user?.id,
            metadata: sharedMetadata,
            billing_address_collection: 'auto',
            // Subscription mode always creates a customer and rejects this parameter
            customer_creation: locals.user || isRecurring ? undefined : 'if_required',
        });

        return json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Checkout Error:', err);
        return error(500, err.message);
    }
};
