import { auth } from '$lib/server/auth';
import { getSettings } from '$lib/server/settings';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers,
	});

	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	// Redirect to setup wizard if not yet configured
	const { pathname } = event.url;
	const isPublicPath =
		pathname.startsWith('/setup') ||
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
