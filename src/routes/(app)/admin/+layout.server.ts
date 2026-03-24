import { redirect } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { LayoutServerLoad } from './$types';

// ── Semver comparison ──────────────────────────────────────────────────────────
function isNewer(latest: string, current: string): boolean {
	const parse = (v: string) => v.split('.').map(Number);
	const a = parse(latest);
	const b = parse(current);
	for (let i = 0; i < 3; i++) {
		if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
	}
	return false;
}

// ── In-memory cache (resets on server restart / redeploy) ─────────────────────
let cache: { updateInfo: { version: string; summary: string } | null; fetchedAt: number } | null =
	null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getUpdateInfo(): Promise<{ version: string; summary: string } | null> {
	const updateUrl = process.env.UPDATE_CHECK_URL;
	if (!updateUrl) return null;

	// Return cached result if fresh
	if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
		return cache.updateInfo;
	}

	try {
		const res = await fetch(updateUrl, {
			headers: { 'Cache-Control': 'no-cache' },
			signal: AbortSignal.timeout(4_000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const latest = await res.json();
		const pkgPath = resolve(process.cwd(), 'package.json');
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

		const updateInfo =
			latest?.version && isNewer(latest.version, pkg.version)
				? { version: latest.version, summary: latest.summary ?? '' }
				: null;

		cache = { updateInfo, fetchedAt: Date.now() };
		return updateInfo;
	} catch {
		// Never break the admin panel because of a failed update check
		return null;
	}
}

// ──────────────────────────────────────────────────────────────────────────────

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = locals.user;

	if (!user) throw redirect(302, '/login');
	if (user.role !== 'admin' && user.role !== 'instructor') throw redirect(302, '/dashboard');

	const updateInfo = await getUpdateInfo();

	return { user, updateInfo };
};
