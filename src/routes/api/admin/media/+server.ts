import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { mediaFiles } from '$lib/server/db/schema';
import { desc, eq, like, and, or } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const UPLOAD_DIR = env.UPLOAD_DIR || 'uploads';
const UPLOAD_URL_PREFIX = env.UPLOAD_URL_PREFIX || '/uploads';

function requireAdmin(locals: App.Locals) {
	if (!locals.user || (locals.user as any).role !== 'admin') {
		throw error(403, 'Forbidden');
	}
}

// GET  /api/admin/media?page=0&q=search
export const GET: RequestHandler = async ({ locals, url }) => {
	requireAdmin(locals);

	const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0'));
	const q = url.searchParams.get('q')?.trim() ?? '';
	const PAGE_SIZE = 40;

	const where = q
		? or(like(mediaFiles.originalName, `%${q}%`), like(mediaFiles.filename, `%${q}%`))
		: undefined;

	const rows = await db.query.mediaFiles.findMany({
		where,
		orderBy: [desc(mediaFiles.createdAt)],
		limit: PAGE_SIZE,
		offset: page * PAGE_SIZE,
	});

	return json({ files: rows, page, hasMore: rows.length === PAGE_SIZE });
};

// DELETE  /api/admin/media  body: { id: number }
export const DELETE: RequestHandler = async ({ locals, request }) => {
	requireAdmin(locals);

	const { id } = (await request.json()) as { id: number };
	if (!id) return json({ ok: false, error: 'No id provided' });

	const [file] = await db
		.delete(mediaFiles)
		.where(eq(mediaFiles.id, id))
		.returning();

	if (!file) return json({ ok: false, error: 'Not found' });

	// Best-effort delete from disk
	if (file.url.startsWith(UPLOAD_URL_PREFIX)) {
		const relativePath = file.url.slice(UPLOAD_URL_PREFIX.length);
		const fullPath = join(UPLOAD_DIR, relativePath);
		await unlink(fullPath).catch(() => {});
	}

	return json({ ok: true });
};
