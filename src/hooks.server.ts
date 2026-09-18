import { dev } from '$app/environment';
import { auth } from '$lib/server/auth';
import { isDatabaseConfigured } from '$lib/server/config';
import { getSettings } from '$lib/server/settings';
import { isSetupUnlocked, logSetupToken } from '$lib/server/setup-token';
import { json, redirect } from '@sveltejs/kit';
import type { Handle, ServerInit } from '@sveltejs/kit';

// Print the setup token to the server log while setup is still open.
// Not awaited: an unreachable DB must not delay server start.
export const init: ServerInit = () => {
	if (dev) return;
	void (async () => {
		const settings = isDatabaseConfigured() ? await getSettings() : null;
		if (!settings?.setupCompleted) logSetupToken();
	})();
};

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const isSetupPath = pathname === '/setup' || pathname.startsWith('/setup/');

	event.locals.setupUnlocked = isSetupUnlocked(event.cookies);

	// No database configured yet: only the setup wizard can work
	if (!isDatabaseConfigured()) {
		event.locals.user = null;
		event.locals.session = null;
		if (isSetupPath || pathname.startsWith('/_app/')) return resolve(event);
		if (pathname.startsWith('/api/')) return json({ error: 'not_configured' }, { status: 503 });
		redirect(302, '/setup');
	}

	let session = null;
	try {
		session = await auth.api.getSession({
			headers: event.request.headers,
		});
	} catch (err) {
		// A broken DB must not lock users out of the wizard that lets them fix it
		if (!isSetupPath) throw err;
	}

	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	// Redirect to setup wizard if not yet configured
	const isPublicPath =
		isSetupPath ||
		pathname.startsWith('/api/') ||
		pathname.startsWith('/_app/');

	if (!isPublicPath) {
		let setupCompleted = true;
		try {
			const settings = await getSettings();
			setupCompleted = settings?.setupCompleted ?? false;
		} catch {
			// DB not reachable — let the app show its own error
		}
		if (!setupCompleted) {
			redirect(302, '/setup');
		}
	}

	return resolve(event);
};
