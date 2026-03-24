import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mediaFiles } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	const files = await db.query.mediaFiles.findMany({
		orderBy: [desc(mediaFiles.createdAt)],
		limit: 80,
	});

	return { files };
};
