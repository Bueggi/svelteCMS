import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { siteSettings, user } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getSettings, invalidateSettings } from '$lib/server/settings';
import { auth } from '$lib/server/auth';
import { env } from '$env/dynamic/private';
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

export const load: PageServerLoad = async ({ url }) => {
	const settings = await getSettings();

	if (settings?.setupCompleted) {
		redirect(302, '/admin');
	}

	const step = Math.max(1, Math.min(4, parseInt(url.searchParams.get('step') || '1')));

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
		step,
		appName: settings?.appName ?? '',
		defaultLanguage: (settings?.defaultLanguage ?? 'de') as 'de' | 'en' | 'es' | 'fr',
		dbUrl: maskDbUrl(env.DATABASE_URL),
		dbOk,
		dbError,
	};
};

export const actions: Actions = {
	step1: async ({ request }) => {
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

	step2: async ({ request }) => {
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

	step3: async ({ request }) => {
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

	step4: async ({ request }) => {
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
		redirect(302, '/admin');
	},
};
