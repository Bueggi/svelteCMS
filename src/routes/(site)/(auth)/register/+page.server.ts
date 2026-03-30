import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { siteSettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(302, '/dashboard');

	const settings = await db.query.siteSettings.findFirst({
		where: eq(siteSettings.id, 1),
		columns: { registrationEnabled: true },
	});

	if (settings && settings.registrationEnabled === false) {
		throw redirect(302, '/login');
	}
};
