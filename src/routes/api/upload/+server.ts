import { json, error } from '@sveltejs/kit';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { mediaFiles } from '$lib/server/db/schema';

const UPLOAD_DIR = env.UPLOAD_DIR || 'uploads';
const UPLOAD_URL_PREFIX = env.UPLOAD_URL_PREFIX || '/uploads';

const ALLOWED_TYPES = [
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif',
	'image/svg+xml',
	'image/x-icon',
	'image/vnd.microsoft.icon',
];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

// Types that can't / shouldn't be processed by sharp
const SKIP_OPTIMISE = new Set([
	'image/svg+xml',
	'image/gif',
	'image/x-icon',
	'image/vnd.microsoft.icon',
]);

// Parse "16:9" → { w: 16, h: 9 }
function parseCrop(crop: string | null): { w: number; h: number } | null {
	if (!crop) return null;
	const [w, h] = crop.split(':').map(Number);
	return w > 0 && h > 0 ? { w, h } : null;
}

export const POST: RequestHandler = async ({ request, locals, url: reqUrl }) => {
	if (!locals.user) return error(401, 'Unauthorized');

	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	if (!file) return error(400, 'No file provided');
	if (!ALLOWED_TYPES.includes(file.type)) return error(400, 'File type not allowed.');
	if (file.size > MAX_SIZE_BYTES) return error(400, 'File too large. Maximum 8 MB.');

	// Optional crop ratio from query string, e.g. ?crop=16:9
	const cropRatio = parseCrop(reqUrl.searchParams.get('crop'));

	const now = new Date();
	const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
	const targetDir = join(UPLOAD_DIR, subDir);
	try {
		if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });
	} catch (mkdirErr) {
		console.error('[upload] Cannot create upload directory:', targetDir, mkdirErr);
		return error(500, `Upload-Verzeichnis nicht erreichbar: ${UPLOAD_DIR} — bitte UPLOAD_DIR in .env prüfen`);
	}

	const base = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	let finalExt = '.jpg';
	let mimeType = file.type;
	let width: number | undefined;
	let height: number | undefined;
	let url800: string | null = null;
	let url400: string | null = null;
	let blurDataUrl: string | null = null;

	const rawBuffer = Buffer.from(await file.arrayBuffer());

	if (!SKIP_OPTIMISE.has(file.type)) {
		try {
			const sharp = (await import('sharp')).default;
			// Ensure sharp is working (ARM64 / aarch64 may need native rebuild)


			// Auto-correct EXIF orientation on all pipelines
			let base$ = sharp(rawBuffer).rotate();

			// ── Smart crop (optional) ────────────────────────────────
			if (cropRatio) {
				base$ = base$.resize({
					width: 1920,
					height: Math.round(1920 * (cropRatio.h / cropRatio.w)),
					fit: 'cover',
					position: 'attention', // smart crop: keeps faces / high-contrast areas
					withoutEnlargement: true,
				});
			}

			const meta = await sharp(rawBuffer).metadata();
			width = meta.width;
			height = meta.height;

			finalExt = '.webp';
			mimeType = 'image/webp';

			// ── Full size (max 1920px) ───────────────────────────────
			const fullBuf = await base$
				.clone()
				.resize({ width: 1920, withoutEnlargement: true })
				.webp({ quality: 82 })
				.toBuffer();
			await writeFile(join(targetDir, `${base}.webp`), fullBuf);

			// ── Medium (max 800px) ───────────────────────────────────
			const buf800 = await base$
				.clone()
				.resize({ width: 800, withoutEnlargement: true })
				.webp({ quality: 82 })
				.toBuffer();
			await writeFile(join(targetDir, `${base}-800.webp`), buf800);
			url800 = `${UPLOAD_URL_PREFIX}/${subDir}/${base}-800.webp`;

			// ── Small (max 400px) ────────────────────────────────────
			const buf400 = await base$
				.clone()
				.resize({ width: 400, withoutEnlargement: true })
				.webp({ quality: 82 })
				.toBuffer();
			await writeFile(join(targetDir, `${base}-400.webp`), buf400);
			url400 = `${UPLOAD_URL_PREFIX}/${subDir}/${base}-400.webp`;

			// ── LQIP blur placeholder (20px, base64) ─────────────────
			const lqipBuf = await base$
				.clone()
				.resize({ width: 20 })
				.webp({ quality: 20 })
				.toBuffer();
			blurDataUrl = `data:image/webp;base64,${lqipBuf.toString('base64')}`;

			// Record final dimensions from full-size output
			const fullMeta = await sharp(fullBuf).metadata();
			width = fullMeta.width ?? width;
			height = fullMeta.height ?? height;
		} catch (sharpErr) {
			// Sharp failed (e.g. native binary missing on ARM64) — save original as-is
			console.warn('[upload] sharp failed, saving original:', sharpErr instanceof Error ? sharpErr.message : sharpErr);
			const ext = file.name.match(/\.[^.]+$/)?.[0] ?? '.bin';
			finalExt = ext;
			await writeFile(join(targetDir, `${base}${finalExt}`), rawBuffer);
		}
	} else {
		// SVG / GIF / ICO — save unchanged
		const ext = file.name.match(/\.[^.]+$/)?.[0] ?? '.bin';
		finalExt = ext;
		await writeFile(join(targetDir, `${base}${finalExt}`), rawBuffer);
	}

	const filename = `${base}${finalExt}`;
	const fileUrl = `${UPLOAD_URL_PREFIX}/${subDir}/${filename}`;

	// ── Save to media library (best-effort) ─────────────────────────
	try {
		await db.insert(mediaFiles).values({
			filename,
			url: fileUrl,
			url800,
			url400,
			blurDataUrl,
			originalName: file.name,
			mimeType,
			size: rawBuffer.length,
			width: width ?? null,
			height: height ?? null,
			uploadedBy: locals.user.id,
		});
	} catch {
		// Non-fatal
	}

	return json({ url: fileUrl, url800, url400, blurDataUrl });
};
