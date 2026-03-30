import { db } from './db';
import { siteSettings, taxRates } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

type Settings = typeof siteSettings.$inferSelect;

let cache: Settings | null = null;
let cacheAt = 0;
const TTL = 30_000;

export async function getSettings(): Promise<Settings | null> {
	if (cache && Date.now() - cacheAt < TTL) return cache;
	try {
		cache = (await db.query.siteSettings.findFirst({ where: eq(siteSettings.id, 1) })) ?? null;
		cacheAt = Date.now();
	} catch (err) {
		console.error('[settings] DB query failed — schema may be out of sync:', err);
		cache = null;
	}
	return cache;
}

export function invalidateSettings() {
	cache = null;
}

// Priority: DB value > env var > undefined
// The DB (admin settings / setup wizard) always wins; env vars are fallback only.
export async function getStripeKey(): Promise<string | undefined> {
	const s = await getSettings();
	return s?.stripeSecretKey || env.STRIPE_SECRET_KEY || undefined;
}

export async function getStripeTestKey(): Promise<string | undefined> {
	const s = await getSettings();
	return s?.stripeTestSecretKey || env.STRIPE_TEST_SECRET_KEY || undefined;
}

export async function getWebhookSecret(): Promise<string | undefined> {
	const s = await getSettings();
	return s?.stripeWebhookSecret || env.STRIPE_WEBHOOK_SECRET || undefined;
}

export async function getSmtpConfig() {
	const s = await getSettings();
	return {
		host: s?.smtpHost || env.SMTP_HOST || undefined,
		port: s?.smtpPort || env.SMTP_PORT || undefined,
		user: s?.smtpUser || env.SMTP_USER || undefined,
		pass: s?.smtpPass || env.SMTP_PASS || undefined,
		secure: s?.smtpSecure || env.SMTP_SECURE === 'true' || false,
		from: s?.smtpFrom || env.SMTP_FROM || undefined,
	};
}

export async function getPayPalConfig(): Promise<{ clientId: string; clientSecret: string; sandbox: boolean } | null> {
	const s = await getSettings();
	const clientId = s?.paypalClientId || env.PAYPAL_CLIENT_ID || undefined;
	const clientSecret = s?.paypalClientSecret || env.PAYPAL_CLIENT_SECRET || undefined;
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret, sandbox: s?.paypalSandbox ?? true };
}

/** Returns which credentials are coming from env vars (DB is empty for those) — used for admin UI hints. */
export async function getEnvVarStatus() {
	const s = await getSettings();
	return {
		stripeSecretKey:    !s?.stripeSecretKey    && !!env.STRIPE_SECRET_KEY,
		stripeWebhookSecret:!s?.stripeWebhookSecret && !!env.STRIPE_WEBHOOK_SECRET,
		stripePublishableKey: !s?.stripePublishableKey && !!(env as any).PUBLIC_STRIPE_PUBLISHABLE_KEY,
		smtpHost:           !s?.smtpHost           && !!env.SMTP_HOST,
		smtpUser:           !s?.smtpUser           && !!env.SMTP_USER,
		paypalClientId:     !s?.paypalClientId     && !!env.PAYPAL_CLIENT_ID,
		paypalClientSecret: !s?.paypalClientSecret && !!env.PAYPAL_CLIENT_SECRET,
	};
}

export async function getVatConfig() {
	const s = await getSettings();
	return {
		vatRate: s?.vatRate ?? 0,
		reverseChargeEnabled: s?.reverseChargeEnabled ?? false,
		companyCountry: s?.companyCountry ?? 'DE',
	};
}

export async function getTaxRates() {
	return db.select().from(taxRates).orderBy(taxRates.countryCode);
}

/** Returns the configured rate for a specific country code, or null if none configured / disabled. */
export async function getTaxRateForCountry(countryCode: string): Promise<number | null> {
	const row = await db.query.taxRates.findFirst({
		where: and(eq(taxRates.countryCode, countryCode.toUpperCase()), eq(taxRates.isEnabled, true)),
	});
	return row?.rate ?? null;
}

export async function getEnabledPaymentMethods(): Promise<string[]> {
	const s = await getSettings();
	try {
		const raw = s?.enabledPaymentMethods;
		if (!raw) return ['card'];
		return JSON.parse(raw) as string[];
	} catch {
		return ['card'];
	}
}
