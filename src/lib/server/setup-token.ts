import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

/**
 * The setup wizard creates the first admin and (optionally) stores the DB connection,
 * so whoever reaches /setup first would own the instance. To prevent that, the wizard
 * is locked behind a token that only the person with server access can read (server log).
 *
 * SETUP_TOKEN in the environment pins the token (e.g. set by an installer);
 * otherwise a random one is generated per server process.
 */
const COOKIE = 'setup_token';
const g = globalThis as unknown as { __setupToken?: string };

export function getSetupToken(): string {
	const fromEnv = env.SETUP_TOKEN?.trim();
	if (fromEnv) return fromEnv;
	return (g.__setupToken ??= randomBytes(24).toString('base64url'));
}

export function tokenMatches(candidate: string): boolean {
	const a = createHash('sha256').update(candidate).digest();
	const b = createHash('sha256').update(getSetupToken()).digest();
	return timingSafeEqual(a, b);
}

export function isSetupUnlocked(cookies: Cookies): boolean {
	if (dev) return true;
	const value = cookies.get(COOKIE);
	return !!value && tokenMatches(value);
}

export function unlockSetup(cookies: Cookies, secure: boolean): void {
	cookies.set(COOKIE, getSetupToken(), {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		// Explicit: SvelteKit defaults to secure, which browsers drop on plain http (e.g. before TLS is set up)
		secure,
		maxAge: 60 * 60 * 12,
	});
}

export function lockSetup(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}

export function logSetupToken(): void {
	if (dev) return;
	console.log(
		[
			'',
			'[setup] Setup ist noch nicht abgeschlossen / Setup is not completed yet.',
			`[setup] Setup-Token: ${getSetupToken()}`,
			'[setup] Open /setup in your browser and enter the token.',
			'',
		].join('\n')
	);
}
