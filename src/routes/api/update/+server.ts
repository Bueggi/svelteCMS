import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/update
 * Triggers a Coolify deploy via the configured webhook URL.
 * Requires COOLIFY_DEPLOY_WEBHOOK_URL env var.
 */
export const POST: RequestHandler = async ({ locals }) => {
	if (locals.user?.role !== 'admin') throw error(403);

	const webhookUrl = process.env.COOLIFY_DEPLOY_WEBHOOK_URL;
	if (!webhookUrl) {
		return json({ ok: false, error: 'COOLIFY_DEPLOY_WEBHOOK_URL is not configured.' });
	}

	try {
		// Coolify deploy webhooks are triggered via GET request
		const res = await fetch(webhookUrl, {
			method: 'GET',
			signal: AbortSignal.timeout(10_000)
		});
		if (!res.ok) {
			return json({ ok: false, error: `Coolify responded with ${res.status}` });
		}
		return json({ ok: true });
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unknown error' });
	}
};
