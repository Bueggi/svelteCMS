import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Redirect to the intermediate checkout page which shows order bumps
export const GET: RequestHandler = async ({ params, url }) => {
    const email = url.searchParams.get('email');
    const target = `/checkout/${params.courseSlug}${email ? `?email=${encodeURIComponent(email)}` : ''}`;
    throw redirect(302, target);
};
