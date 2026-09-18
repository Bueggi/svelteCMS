import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { siteSettings, user } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { resolve } from 'node:path';
import { getSettings, invalidateSettings } from '$lib/server/settings';
import { auth, resetAuth } from '$lib/server/auth';
import {
	generateSecret,
	getAuthSecret,
	getConfigPath,
	getDatabaseUrl,
	isDatabaseConfigured,
	isDatabaseFromEnv,
	saveStoredConfig,
} from '$lib/server/config';
import { lockSetup, tokenMatches, unlockSetup } from '$lib/server/setup-token';
import { getT, supportedLangs, type LangKey } from '$lib/i18n';
import type { PageServerLoad, Actions } from './$types';

function maskDbUrl(raw: string | undefined): string {
	if (!raw) return '(DATABASE_URL nicht gesetzt)';
	try {
		const u = new URL(raw);
		if (u.password) u.password = '••••••';
		return u.toString();
	} catch {
		return raw.replace(/:([^@/]+)@/, ':••••••@');
	}
}

/** Node's connection errors (e.g. ECONNREFUSED) often have an empty message, so fall back to the code. */
function describeError(e: any): string {
	const inner = e?.cause ?? e;
	return inner?.message || inner?.code || inner?.errors?.[0]?.code || String(inner);
}

/** The wizard runs before a language is chosen, so guess it from the browser. */
function guessLang(request: Request): LangKey {
	const first = request.headers.get('accept-language')?.slice(0, 2).toLowerCase() ?? '';
	return (supportedLangs as string[]).includes(first) ? (first as LangKey) : 'de';
}

/**
 * Every action must call this: SvelteKit runs actions without `load`, so a redirect
 * in `load` alone does not protect them. Once setup is completed the wizard is dead;
 * before that, it requires the setup token.
 */
async function assertSetupOpen(locals: App.Locals) {
	if (isDatabaseConfigured()) {
		const settings = await getSettings();
		if (settings?.setupCompleted) error(403, 'Setup already completed');
	}
	if (!locals.setupUnlocked) error(403, 'Setup token required');
}

export const load: PageServerLoad = async ({ url, request, locals }) => {
	const defaultLanguage = guessLang(request);
	const base = {
		locked: false,
		showDbStep: false,
		step: 1,
		appName: '',
		defaultLanguage: defaultLanguage as 'de' | 'en' | 'es' | 'fr',
		dbUrl: '',
		dbOk: false,
		dbError: null as string | null,
	};

	const dbConfigured = isDatabaseConfigured();
	const settings = dbConfigured ? await getSettings() : null;

	if (settings?.setupCompleted) {
		redirect(302, '/admin');
	}

	if (!locals.setupUnlocked) {
		return { ...base, locked: true, step: 0 };
	}

	// Step 0 (database) only exists when DATABASE_URL isn't provided by the environment
	const showDbStep = !isDatabaseFromEnv();

	const requested = parseInt(url.searchParams.get('step') ?? '', 10);

	// Without a database nothing else can work. No redirect here: a failed stepDb submit
	// re-renders this page without a ?step= param and must keep showing its error.
	if (!dbConfigured) {
		return { ...base, showDbStep, step: 0 };
	}

	const firstStep = showDbStep ? 0 : 1;
	const step = Number.isNaN(requested) ? 1 : Math.max(firstStep, Math.min(4, requested));

	// Guard: can't skip step 1 (no siteSettings row yet)
	if (step > 1 && !settings) {
		redirect(302, '/setup?step=1');
	}

	// Guard: can't skip step 2 (no admin user yet)
	if (step > 2) {
		const adminUser = await db.query.user.findFirst({
			where: eq(user.role, 'admin'),
		});
		if (!adminUser) redirect(302, '/setup?step=2');
	}

	let dbOk = false;
	let dbError: string | null = null;
	try {
		await db.execute(sql`SELECT 1`);
		dbOk = true;
	} catch (e: any) {
		dbError = e?.message ?? 'Verbindungsfehler';
	}

	return {
		...base,
		showDbStep,
		step,
		appName: settings?.appName ?? '',
		defaultLanguage: (settings?.defaultLanguage ?? defaultLanguage) as 'de' | 'en' | 'es' | 'fr',
		dbUrl: maskDbUrl(getDatabaseUrl()),
		dbOk,
		dbError,
	};
};

export const actions: Actions = {
	unlock: async ({ request, cookies, url }) => {
		if (isDatabaseConfigured()) {
			const settings = await getSettings();
			if (settings?.setupCompleted) error(403, 'Setup already completed');
		}

		const data = await request.formData();
		const token = ((data.get('token') as string) ?? '').trim();

		if (!token || !tokenMatches(token)) {
			return fail(403, { error: getT(guessLang(request))('setupTokenInvalid') });
		}

		unlockSetup(cookies, url.protocol === 'https:');
		redirect(303, '/setup');
	},

	stepDb: async ({ request, locals }) => {
		await assertSetupOpen(locals);
		// A DATABASE_URL from the environment always wins — don't pretend to change it here
		if (isDatabaseFromEnv()) error(403, 'Database is configured via DATABASE_URL');

		const t = getT(guessLang(request));
		const data = await request.formData();
		const databaseUrl = ((data.get('databaseUrl') as string) ?? '').trim();

		try {
			if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) throw new Error('bad protocol');
			new URL(databaseUrl);
		} catch {
			return fail(400, { step: 0, error: t('setupDbUrlInvalid') });
		}

		// Test the connection and create the schema on an empty database.
		// A database that already has tables (e.g. restored/pushed) is left untouched.
		const client = postgres(databaseUrl, { max: 1, connect_timeout: 10, idle_timeout: 5 });
		try {
			await client`SELECT 1`;
			const [{ exists }] = await client`SELECT to_regclass('public."user"') IS NOT NULL AS exists`;
			if (!exists) {
				await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'drizzle') });
			}
		} catch (e: any) {
			return fail(400, { step: 0, error: `${t('setupDbConnFailed')}: ${describeError(e)}` });
		} finally {
			await client.end({ timeout: 5 }).catch(() => {});
		}

		try {
			saveStoredConfig({
				databaseUrl,
				// Sessions need a signing secret; generate one so nobody has to think about it
				...(getAuthSecret() ? {} : { authSecret: generateSecret() }),
			});
		} catch (e: any) {
			return fail(500, {
				step: 0,
				error: `${t('setupDbSaveFailed')} (${getConfigPath()}): ${describeError(e)}`,
			});
		}

		resetAuth();
		invalidateSettings();
		redirect(302, '/setup?step=1');
	},

	step1: async ({ request, locals }) => {
		await assertSetupOpen(locals);
		const data = await request.formData();
		const appName = (data.get('appName') as string)?.trim();

		if (!appName) return fail(400, { step: 1, error: 'App name is required.' });

		const rawLang = (data.get('defaultLanguage') as string)?.trim();
		const defaultLanguage = (['de', 'en', 'es', 'fr'].includes(rawLang) ? rawLang : 'de') as 'de' | 'en' | 'es' | 'fr';

		await db
			.insert(siteSettings)
			.values({ id: 1, appName, defaultLanguage, updatedAt: new Date() })
			.onConflictDoUpdate({
				target: siteSettings.id,
				set: { appName, defaultLanguage, updatedAt: new Date() },
			});

		invalidateSettings();
		redirect(302, '/setup?step=2');
	},

	step2: async ({ request, locals }) => {
		await assertSetupOpen(locals);
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const email = (data.get('email') as string)?.trim();
		const password = data.get('password') as string;

		if (!name || !email || !password) {
			return fail(400, { step: 2, error: 'Alle Felder sind erforderlich.' });
		}
		if (password.length < 8) {
			return fail(400, { step: 2, error: 'Das Passwort muss mindestens 8 Zeichen haben.' });
		}

		const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
		if (existing) {
			return fail(400, { step: 2, error: 'Ein Benutzer mit dieser E-Mail existiert bereits.' });
		}

		try {
			await auth.api.signUpEmail({ body: { name, email, password } });
		} catch (e: any) {
			return fail(400, { step: 2, error: e?.message || 'Konto konnte nicht erstellt werden.' });
		}

		await db
			.update(user)
			.set({ role: 'admin', emailVerified: true })
			.where(eq(user.email, email));

		redirect(302, '/setup?step=3');
	},

	step3: async ({ request, locals }) => {
		await assertSetupOpen(locals);
		const data = await request.formData();
		const stripeSecretKey = (data.get('stripeSecretKey') as string)?.trim() || null;
		const stripePublishableKey = (data.get('stripePublishableKey') as string)?.trim() || null;
		const stripeWebhookSecret = (data.get('stripeWebhookSecret') as string)?.trim() || null;

		await db
			.update(siteSettings)
			.set({ stripeSecretKey, stripePublishableKey, stripeWebhookSecret, updatedAt: new Date() })
			.where(eq(siteSettings.id, 1));

		invalidateSettings();
		redirect(302, '/setup?step=4');
	},

	step4: async ({ request, cookies, locals }) => {
		await assertSetupOpen(locals);
		const data = await request.formData();
		const smtpHost = (data.get('smtpHost') as string)?.trim() || null;
		const smtpPort = (data.get('smtpPort') as string)?.trim() || null;
		const smtpUser = (data.get('smtpUser') as string)?.trim() || null;
		const smtpPass = (data.get('smtpPass') as string)?.trim() || null;
		const smtpFrom = (data.get('smtpFrom') as string)?.trim() || null;
		const smtpSecure = data.get('smtpSecure') === 'on';

		await db
			.update(siteSettings)
			.set({ smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, smtpSecure, updatedAt: new Date() })
			.where(eq(siteSettings.id, 1));

		await db
			.update(siteSettings)
			.set({ setupCompleted: true, updatedAt: new Date() })
			.where(eq(siteSettings.id, 1));

		invalidateSettings();
		lockSetup(cookies);
		redirect(302, '/admin');
	},
};
