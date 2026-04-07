import { error } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { resolve } from 'path';
import type { RequestHandler } from './$types';

/**
 * POST /api/update
 * Spawns deploy/self-update.sh as a detached background process.
 * Returns immediately with { ok: true } — the script handles the rest.
 * Only accessible by admins.
 */
export const POST: RequestHandler = async ({ locals }) => {
	if (locals.user?.role !== 'admin') throw error(403);

	const scriptPath = resolve(process.cwd(), 'deploy/self-update.sh');

	try {
		// Clear log before starting so UI only shows current attempt
		const { writeFileSync } = await import('fs');
		const logPath = resolve(process.cwd(), 'update.log');
		writeFileSync(logPath, '');

		const child = spawn('bash', [scriptPath], {
			detached: true,
			stdio: 'ignore',
			cwd: process.cwd(),
		});
		child.unref(); // Allow Node.js to exit without waiting for the child
	} catch (e: any) {
		return new Response(JSON.stringify({ ok: false, error: e?.message ?? 'Spawn failed' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return new Response(JSON.stringify({ ok: true }), {
		headers: { 'Content-Type': 'application/json' },
	});
};

/**
 * GET /api/update/log
 * Streams the last N lines of update.log as plain text (for progress display).
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (locals.user?.role !== 'admin') throw error(403);

	const { readFileSync, existsSync } = await import('fs');
	const logPath = resolve(process.cwd(), 'update.log');

	if (!existsSync(logPath)) {
		return new Response('(kein Log vorhanden)', { headers: { 'Content-Type': 'text/plain' } });
	}

	const lines = parseInt(url.searchParams.get('lines') ?? '80', 10);
	const content = readFileSync(logPath, 'utf-8');
	const tail = content.split('\n').slice(-lines).join('\n');

	return new Response(tail, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
