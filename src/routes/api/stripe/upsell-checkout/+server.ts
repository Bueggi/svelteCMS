import { json, error } from '@sveltejs/kit';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey } from '$lib/server/settings';
import { db } from '$lib/server/db';
import { courses } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';

const PUBLIC_BASE_URL = env.PUBLIC_BASE_URL || 'http://localhost:5173';

export const POST: RequestHandler = async ({ request, locals }) => {
    const body = await request.json() as {
        courseId: string;
        funnelSlug: string;
        upsellId: string;
        specialPrice?: number | null;
        nextUrl: string;
    };

    const { courseId, funnelSlug, upsellId, specialPrice, nextUrl } = body;

    const stripeKey = await getStripeKey();
    if (!stripeKey) return error(500, 'Stripe not configured');
    const stripe = getStripeClient(stripeKey);

    const course = await db.query.courses.findFirst({ where: eq(courses.id, courseId) });
    if (!course) return error(404, 'Course not found');

    const price = specialPrice ?? course.price;
    const successUrl = `${PUBLIC_BASE_URL}${nextUrl}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${PUBLIC_BASE_URL}/f/${funnelSlug}/u/${upsellId}`;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: course.title,
                        description: course.subtitle || undefined,
                        images: course.thumbnailUrl ? [course.thumbnailUrl] : undefined,
                    },
                    unit_amount: price,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: locals.user?.email || undefined,
            client_reference_id: locals.user?.id,
            metadata: {
                userId: locals.user?.id || '',
                courseId: course.id,
                courseIds: course.id,
                isGuest: locals.user ? 'false' : 'true',
                reverseCharge: 'false',
                billingName: '',
                billingEmail: '',
                billingStreet: '',
                billingZip: '',
                billingCity: '',
                billingCountry: '',
                billingVatId: '',
            },
        });

        return json({ url: session.url });
    } catch (err: any) {
        return error(500, err.message);
    }
};
