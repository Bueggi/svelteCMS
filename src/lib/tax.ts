/**
 * VAT determination shared by the checkout (display) and the invoice service (legally binding),
 * so the rate a customer sees is exactly the rate on the invoice and in the DATEV export.
 * Prices are gross (VAT included); only reverse charge lowers the amount charged.
 */

export const EU_COUNTRIES = [
	'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
	'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
];

export type TaxTreatment = 'standard' | 'oss' | 'reverse_charge' | 'third_country' | 'small_business';

export interface TaxContext {
	operatorCountry: string;
	/** Operator's domestic rate in percent, e.g. 19 */
	defaultRate: number;
	smallBusiness: boolean;
	ossEnabled: boolean;
	reverseChargeEnabled: boolean;
	/** Enabled per-country rates (percent), keyed by ISO code */
	countryRates: Record<string, number>;
}

export interface TaxCustomer {
	country?: string | null;
	vatId?: string | null;
	/** Customer declared a business purchase */
	isBusiness?: boolean;
}

/** VAT IDs start with the country prefix (Greece uses EL). */
export function vatIdCountry(vatId: string | null | undefined): string | null {
	const prefix = vatId?.trim().slice(0, 2).toUpperCase();
	if (!prefix || prefix.length < 2) return null;
	return prefix === 'EL' ? 'GR' : prefix;
}

export function determineTax(ctx: TaxContext, customer: TaxCustomer): { treatment: TaxTreatment; rate: number } {
	if (ctx.smallBusiness) return { treatment: 'small_business', rate: 0 };

	const operator = ctx.operatorCountry.toUpperCase();
	const country = customer.country?.toUpperCase() || operator;

	const vatCountry = vatIdCountry(customer.vatId);
	if (
		ctx.reverseChargeEnabled &&
		customer.isBusiness &&
		(customer.vatId?.trim().length ?? 0) >= 4 &&
		vatCountry && EU_COUNTRIES.includes(vatCountry) && vatCountry !== operator
	) {
		return { treatment: 'reverse_charge', rate: 0 };
	}

	// Electronic services to customers outside the EU are not taxable here
	if (!EU_COUNTRIES.includes(country) && country !== operator) {
		return { treatment: 'third_country', rate: 0 };
	}

	if (ctx.ossEnabled && country !== operator) {
		return { treatment: 'oss', rate: ctx.countryRates[country] ?? ctx.defaultRate };
	}

	return { treatment: 'standard', rate: ctx.defaultRate };
}

/** Amount actually charged for a gross price: reverse charge customers pay the net price. */
export function chargeableAmount(grossCents: number, ctx: TaxContext, treatment: TaxTreatment): number {
	return treatment === 'reverse_charge' && ctx.defaultRate > 0
		? Math.round(grossCents / (1 + ctx.defaultRate / 100))
		: grossCents;
}

/** Splits a gross amount into net + VAT; the parts always add up to the gross amount. */
export function splitGross(grossCents: number, rate: number): { netCents: number; vatCents: number } {
	const vatCents = rate > 0 ? Math.round((grossCents * rate) / (100 + rate)) : 0;
	return { netCents: grossCents - vatCents, vatCents };
}

/** Legal note printed on the invoice for tax-exempt / special treatments. */
export function taxNote(treatment: TaxTreatment): string {
	switch (treatment) {
		case 'reverse_charge':
			return 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG / Art. 196 MwStSystRL).';
		case 'third_country':
			return 'Nicht im Inland steuerbare Leistung (Leistungsort im Drittland, § 3a Abs. 2 bzw. Abs. 5 UStG).';
		case 'small_business':
			return 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';
		case 'oss':
			return 'Umsatzsteuer des Bestimmungslandes (One-Stop-Shop-Verfahren, § 18j UStG).';
		default:
			return '';
	}
}
