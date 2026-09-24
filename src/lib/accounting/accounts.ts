import type { TaxTreatment } from '$lib/tax';

/**
 * DATEV account mapping. Defaults follow the DATEV standard charts (SKR03 / SKR04); every
 * account can be overridden in the admin settings — the tax advisor has the final say.
 */

export type ChartOfAccounts = 'SKR03' | 'SKR04';

export interface AccountMapping {
	revenueStandard: string;      // Erlöse mit inländischer USt (Automatikkonto)
	revenueOss: string;           // Erlöse OSS (EU-Verbraucher, Steuer des Bestimmungslandes)
	revenueReverseCharge: string; // Erlöse sonstige Leistungen EU, Steuerschuldner Leistungsempfänger
	revenueThirdCountry: string;  // Erlöse im Inland nicht steuerbar (Drittland)
	revenueSmallBusiness: string; // Erlöse Kleinunternehmer § 19 UStG
	clearingStripe: string;       // Geldtransit / Verrechnungskonto Stripe
	clearingPaypal: string;       // Geldtransit / Verrechnungskonto PayPal
	fees: string;                 // Nebenkosten des Geldverkehrs (Zahlungsgebühren)
	feesTaxKey: string;           // BU-Schlüssel für Gebühren (leer = keine Steuer)
	chargebackLoss: string;       // Verluste aus Rückbuchungen (Chargebacks)
}

export const ACCOUNT_LABELS: Record<keyof AccountMapping, string> = {
	revenueStandard: 'Erlöse Inland (mit USt)',
	revenueOss: 'Erlöse OSS (EU-Privatkunden)',
	revenueReverseCharge: 'Erlöse EU Reverse Charge (B2B)',
	revenueThirdCountry: 'Erlöse Drittland (nicht steuerbar)',
	revenueSmallBusiness: 'Erlöse Kleinunternehmer (§ 19 UStG)',
	clearingStripe: 'Geldtransit Stripe',
	clearingPaypal: 'Geldtransit PayPal',
	fees: 'Zahlungsgebühren',
	feesTaxKey: 'BU-Schlüssel Gebühren',
	chargebackLoss: 'Verluste Chargebacks',
};

// revenueOss is intentionally empty: DATEV has several OSS variants — the advisor has to choose.
export const DEFAULT_ACCOUNTS: Record<ChartOfAccounts, AccountMapping> = {
	SKR03: {
		revenueStandard: '8400',
		revenueOss: '',
		revenueReverseCharge: '8336',
		revenueThirdCountry: '8338',
		revenueSmallBusiness: '8195',
		clearingStripe: '1360',
		clearingPaypal: '1360',
		fees: '4970',
		feesTaxKey: '',
		chargebackLoss: '2400',
	},
	SKR04: {
		revenueStandard: '4400',
		revenueOss: '',
		revenueReverseCharge: '4336',
		revenueThirdCountry: '4338',
		revenueSmallBusiness: '4185',
		clearingStripe: '1460',
		clearingPaypal: '1460',
		fees: '6855',
		feesTaxKey: '',
		chargebackLoss: '6930',
	},
};

export function resolveAccounts(chart: string | null | undefined, overridesJson: string | null | undefined): AccountMapping {
	const base = DEFAULT_ACCOUNTS[(chart === 'SKR04' ? 'SKR04' : 'SKR03')];
	let overrides: Partial<AccountMapping> = {};
	try { overrides = JSON.parse(overridesJson || '{}'); } catch { /* ignore */ }
	const merged = { ...base };
	for (const key of Object.keys(base) as (keyof AccountMapping)[]) {
		const v = overrides[key];
		if (typeof v === 'string' && v.trim() !== '') merged[key] = v.trim();
	}
	return merged;
}

export function revenueAccount(accounts: AccountMapping, treatment: TaxTreatment): string {
	switch (treatment) {
		case 'oss': return accounts.revenueOss;
		case 'reverse_charge': return accounts.revenueReverseCharge;
		case 'third_country': return accounts.revenueThirdCountry;
		case 'small_business': return accounts.revenueSmallBusiness;
		default: return accounts.revenueStandard;
	}
}
