import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { siteSettings } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { invalidateSettings, getEnvVarStatus } from '$lib/server/settings';
import { getDatabaseUrl } from '$lib/server/config';
import { REQUIRED_TEMPLATE_VARIABLES } from '$lib/server/invoiceTemplate';
import { ACCOUNT_LABELS } from '$lib/accounting/accounts';
import type { PageServerLoad, Actions } from './$types';

function maskDbUrl(raw: string | undefined): string {
	if (!raw) return '(nicht gesetzt)';
	try {
		const u = new URL(raw);
		if (u.password) u.password = '••••••';
		return u.toString();
	} catch {
		return raw.replace(/:([^@/]+)@/, ':••••••@');
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');

	let settings = await db.query.siteSettings.findFirst({
		where: eq(siteSettings.id, 1),
	});

	if (!settings) {
		settings = {
			appName: 'Svelte Course',
			activeTheme: 'luxurious',
			defaultLanguage: 'de',
			primaryColor: '15 60% 65%',
			secondaryColor: '38 70% 55%',
			accentColor: '15 60% 65%',
			backgroundColor: '40 33% 97%',
			foregroundColor: '30 10% 15%',
			logoUrl: '',
			faviconUrl: '',
			adminName: '',
			adminEmail: '',
			setupCompleted: true,
			stripeSecretKey: null,
			stripePublishableKey: null,
			stripeWebhookSecret: null,
			smtpHost: null,
			smtpPort: null,
			smtpUser: null,
			smtpPass: null,
			smtpSecure: false,
			smtpFrom: null,
			paypalClientId: null,
			paypalClientSecret: null,
			paypalSandbox: true,
			enabledPaymentMethods: '["card"]',
		vatRate: 0,
		reverseChargeEnabled: false,
		companyName: null,
		companyStreet: null,
		companyCity: null,
		companyZip: null,
		companyCountry: 'DE',
		companyVatId: null,
		companyEmail: null,
		companyPhone: null,
		} as any;
	}

	const envVars = await getEnvVarStatus();

	let dbOk = false;
	let dbError: string | null = null;
	try {
		await db.execute(sql`SELECT 1`);
		dbOk = true;
	} catch (e: any) {
		dbError = e?.message ?? 'Unbekannter Fehler';
	}

	return {
		settings,
		envVars,
		dbUrl: maskDbUrl(getDatabaseUrl()),
		dbOk,
		dbError,
		nodeEnv: process.env.NODE_ENV ?? 'production',
	};
};

export const actions: Actions = {
	updateSettings: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();

		const appName = data.get('appName') as string;
		const adminName = data.get('adminName') as string;
		const adminEmail = data.get('adminEmail') as string;
		const defaultLanguage = data.get('defaultLanguage') as 'de' | 'en' | 'es' | 'fr';
		const activeTheme = data.get('activeTheme') as string;
		const logoUrl = data.get('logoUrl') as string;
		const logoText = (data.get('logoText') as string) || null;
		const faviconUrl = data.get('faviconUrl') as string;
		const primaryColor = data.get('primaryColor') as string;
		const secondaryColor = data.get('secondaryColor') as string;
		const accentColor = data.get('accentColor') as string;
		const backgroundColor = data.get('backgroundColor') as string;
		const foregroundColor = data.get('foregroundColor') as string;
		const registrationEnabled = data.get('registrationEnabled') === 'true';
		const siteUrl = (data.get('siteUrl') as string)?.trim() || null;

		// Merge per-theme CSS into existing JSON map
		const cssForActive = (data.get('themeCustomCssForActive') as string) ?? '';
		const existing = await db.query.siteSettings.findFirst({ columns: { themeCustomCss: true, themeFonts: true } });
		let cssMap: Record<string, string> = {};
		try { cssMap = JSON.parse(existing?.themeCustomCss || '{}'); } catch { cssMap = {}; }
		if (cssForActive.trim()) {
			cssMap[activeTheme] = cssForActive;
		} else {
			delete cssMap[activeTheme];
		}
		const themeCustomCss = Object.keys(cssMap).length > 0 ? JSON.stringify(cssMap) : null;

		// Merge per-theme fonts into existing JSON map
		const fontHeading = (data.get('fontHeading') as string)?.trim() || '';
		const fontBody    = (data.get('fontBody')    as string)?.trim() || '';
		let fontsMap: Record<string, { heading: string; body: string }> = {};
		try { fontsMap = JSON.parse(existing?.themeFonts || '{}'); } catch { fontsMap = {}; }
		if (fontHeading || fontBody) {
			fontsMap[activeTheme] = { heading: fontHeading, body: fontBody };
		} else {
			delete fontsMap[activeTheme];
		}
		const themeFonts = Object.keys(fontsMap).length > 0 ? JSON.stringify(fontsMap) : null;

		try {
			await db
				.insert(siteSettings)
				.values({
					id: 1,
					appName,
					adminName,
					adminEmail,
					defaultLanguage,
					activeTheme,
					logoUrl,
					logoText,
					faviconUrl,
					primaryColor,
					secondaryColor,
					accentColor,
					backgroundColor,
					foregroundColor,
					registrationEnabled,
					siteUrl,
					themeCustomCss,
					themeFonts,
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: siteSettings.id,
					set: {
						appName,
						adminName,
						adminEmail,
						defaultLanguage,
						activeTheme,
						logoUrl,
						logoText,
						faviconUrl,
						primaryColor,
						secondaryColor,
						accentColor,
						backgroundColor,
						foregroundColor,
						registrationEnabled,
						siteUrl,
						themeCustomCss,
						themeFonts,
						updatedAt: new Date(),
					},
				});

			invalidateSettings();
			return { success: true };
		} catch (error) {
			console.error('Update site settings error:', error);
			return fail(500, { message: 'Failed to update settings' });
		}
	},

	updateIntegrations: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();

		const stripeSecretKey = (data.get('stripeSecretKey') as string)?.trim() || null;
		const stripePublishableKey = (data.get('stripePublishableKey') as string)?.trim() || null;
		const stripeWebhookSecret = (data.get('stripeWebhookSecret') as string)?.trim() || null;
		const stripeTestSecretKey = (data.get('stripeTestSecretKey') as string)?.trim() || null;
		const stripeTestPublishableKey = (data.get('stripeTestPublishableKey') as string)?.trim() || null;
		const smtpHost = (data.get('smtpHost') as string)?.trim() || null;
		const smtpPort = (data.get('smtpPort') as string)?.trim() || null;
		const smtpUser = (data.get('smtpUser') as string)?.trim() || null;
		const smtpPass = (data.get('smtpPass') as string)?.trim() || null;
		const smtpFrom = (data.get('smtpFrom') as string)?.trim() || null;
		const smtpSecure = data.get('smtpSecure') === 'on';
		const paypalClientId = (data.get('paypalClientId') as string)?.trim() || null;
		const paypalClientSecret = (data.get('paypalClientSecret') as string)?.trim() || null;
		const paypalSandbox = data.get('paypalSandbox') === 'on';
		const paypalWebhookId = (data.get('paypalWebhookId') as string)?.trim() || null;
		const enabledPaymentMethods = (data.get('enabledPaymentMethods') as string) || '["card"]';

		try {
			const values = {
				stripeSecretKey,
				stripePublishableKey,
				stripeWebhookSecret,
				stripeTestSecretKey,
				stripeTestPublishableKey,
				smtpHost,
				smtpPort,
				smtpUser,
				smtpPass,
				smtpFrom,
				smtpSecure,
				paypalClientId,
				paypalClientSecret,
				paypalSandbox,
				paypalWebhookId,
				enabledPaymentMethods,
				updatedAt: new Date(),
			};
			// Upsert: a plain UPDATE silently saves nothing while the settings row doesn't exist yet
			await db
				.insert(siteSettings)
				.values({ id: 1, ...values })
				.onConflictDoUpdate({ target: siteSettings.id, set: values });

			invalidateSettings();
			return { success: true };
		} catch (error) {
			console.error('Update integrations error:', error);
			return fail(500, { message: 'Failed to update integrations' });
		}
	},

	updateInvoicing: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();

		const vatRate = Math.min(100, Math.max(0, parseInt((data.get('vatRate') as string) || '0', 10) || 0));
		const reverseChargeEnabled = data.get('reverseChargeEnabled') === 'on';
		const companyName = (data.get('companyName') as string)?.trim() || null;
		const companyStreet = (data.get('companyStreet') as string)?.trim() || null;
		const companyCity = (data.get('companyCity') as string)?.trim() || null;
		const companyZip = (data.get('companyZip') as string)?.trim() || null;
		const companyCountry = (data.get('companyCountry') as string)?.trim() || 'DE';
		const companyVatId = (data.get('companyVatId') as string)?.trim() || null;
		const companyEmail = (data.get('companyEmail') as string)?.trim() || null;
		const companyPhone = (data.get('companyPhone') as string)?.trim() || null;
		const companyTaxNumber = (data.get('companyTaxNumber') as string)?.trim() || null;
		const companyManagingDirector = (data.get('companyManagingDirector') as string)?.trim() || null;
		const companyRegister = (data.get('companyRegister') as string)?.trim() || null;
		const checkoutButtonColor = (data.get('checkoutButtonColor') as string)?.trim() || null;
		let checkoutLegalTexts: string | null = null;
		try {
			const raw = JSON.parse((data.get('checkoutLegalTexts') as string) || '[]');
			checkoutLegalTexts = Array.isArray(raw) && raw.length > 0 ? JSON.stringify(raw) : null;
		} catch { checkoutLegalTexts = null; }

		try {
			await db
				.insert(siteSettings)
				.values({
					id: 1,
					vatRate,
					reverseChargeEnabled,
					companyName,
					companyStreet,
					companyCity,
					companyZip,
					companyCountry,
					companyVatId,
					companyEmail,
					companyPhone,
					companyTaxNumber,
					companyManagingDirector,
					companyRegister,
					checkoutButtonColor,
					checkoutLegalTexts,
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: siteSettings.id,
					set: {
						vatRate,
						reverseChargeEnabled,
						companyName,
						companyStreet,
						companyCity,
						companyZip,
						companyCountry,
						companyVatId,
						companyEmail,
						companyPhone,
						companyTaxNumber,
						companyManagingDirector,
						companyRegister,
						checkoutButtonColor,
						checkoutLegalTexts,
						updatedAt: new Date(),
					},
				});

			invalidateSettings();
			return { success: true };
		} catch (error) {
			console.error('Update invoicing error:', error);
			return fail(500, { message: 'Failed to update invoicing settings' });
		}
	},

	updateInvoiceTemplate: async ({ request, locals }) => {
		if (!locals.user) return fail(401);
		const data = await request.formData();

		const invoicePrefix = ((data.get('invoicePrefix') as string) || 'INV').trim();
		const invoiceTemplate = (data.get('invoiceTemplate') as string) || null;
		const invoiceFooter = (data.get('invoiceFooter') as string) || null;

		// A custom template must keep the placeholders for mandatory invoice information
		if (invoiceTemplate) {
			const missing = REQUIRED_TEMPLATE_VARIABLES.filter((v) => !invoiceTemplate.includes(`{{${v}}}`));
			if (missing.length > 0) {
				return fail(400, { message: `In der Vorlage fehlen Pflicht-Platzhalter: ${missing.map((v) => `{{${v}}}`).join(', ')}` });
			}
		}

		try {
			await db
				.insert(siteSettings)
				.values({ id: 1, invoicePrefix, invoiceTemplate, invoiceFooter, updatedAt: new Date() })
				.onConflictDoUpdate({
					target: siteSettings.id,
					set: { invoicePrefix, invoiceTemplate, invoiceFooter, updatedAt: new Date() },
				});
			invalidateSettings();
			return { success: true };
		} catch (error) {
			console.error('Update invoice template error:', error);
			return fail(500, { message: 'Failed to update invoice template' });
		}
	},

	updateAccounting: async ({ request, locals }) => {
		if (locals.user?.role !== 'admin') return fail(403, { message: 'Nur für Administratoren' });
		const data = await request.formData();

		const digits = (name: string) => ((data.get(name) as string) ?? '').replace(/\D/g, '') || null;
		const datevChartOfAccounts = data.get('datevChartOfAccounts') === 'SKR04' ? 'SKR04' : 'SKR03';
		const datevAccountLength = Math.min(8, Math.max(4, parseInt(data.get('datevAccountLength') as string, 10) || 4));
		const datevFiscalYearStartMonth = Math.min(12, Math.max(1, parseInt(data.get('datevFiscalYearStartMonth') as string, 10) || 1));

		let accounts: Record<string, string> = {};
		try {
			const raw = JSON.parse((data.get('datevAccounts') as string) || '{}');
			for (const key of Object.keys(ACCOUNT_LABELS)) {
				const v = typeof raw[key] === 'string' ? raw[key].trim() : '';
				if (!v) continue;
				if (!/^\d{1,9}$/.test(v)) return fail(400, { message: `„${ACCOUNT_LABELS[key as keyof typeof ACCOUNT_LABELS]}“ muss eine Nummer sein.` });
				accounts[key] = v;
			}
		} catch {
			accounts = {};
		}

		const values = {
			smallBusiness: data.get('smallBusiness') === 'on',
			ossEnabled: data.get('ossEnabled') === 'on',
			datevConsultantNumber: digits('datevConsultantNumber'),
			datevClientNumber: digits('datevClientNumber'),
			datevChartOfAccounts,
			datevAccountLength,
			datevFiscalYearStartMonth,
			datevAccounts: Object.keys(accounts).length > 0 ? JSON.stringify(accounts) : null,
			updatedAt: new Date(),
		};

		try {
			await db.insert(siteSettings).values({ id: 1, ...values })
				.onConflictDoUpdate({ target: siteSettings.id, set: values });
			invalidateSettings();
			return { success: true };
		} catch (error) {
			console.error('Update accounting settings error:', error);
			return fail(500, { message: 'Speichern fehlgeschlagen' });
		}
	},

	pingDb: async () => {
		try {
			await db.execute(sql`SELECT 1`);
			return { pingOk: true };
		} catch (e: any) {
			return fail(500, { pingOk: false, pingError: e?.message ?? 'Verbindungsfehler' });
		}
	},
};
