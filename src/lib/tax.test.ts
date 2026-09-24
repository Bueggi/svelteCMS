import { describe, it, expect } from 'vitest';
import { determineTax, chargeableAmount, splitGross, type TaxContext } from './tax';

const ctx: TaxContext = {
	operatorCountry: 'DE',
	defaultRate: 19,
	smallBusiness: false,
	ossEnabled: false,
	reverseChargeEnabled: true,
	countryRates: { FR: 20, AT: 20 },
};

describe('determineTax', () => {
	it('domestic consumer pays German VAT', () => {
		expect(determineTax(ctx, { country: 'DE' })).toEqual({ treatment: 'standard', rate: 19 });
	});
	it('EU consumer without OSS pays German VAT', () => {
		expect(determineTax(ctx, { country: 'FR' })).toEqual({ treatment: 'standard', rate: 19 });
	});
	it('EU consumer with OSS pays destination rate', () => {
		expect(determineTax({ ...ctx, ossEnabled: true }, { country: 'FR' })).toEqual({ treatment: 'oss', rate: 20 });
	});
	it('EU business with foreign VAT ID → reverse charge', () => {
		expect(determineTax(ctx, { country: 'FR', vatId: 'FR12345678901', isBusiness: true })).toEqual({ treatment: 'reverse_charge', rate: 0 });
	});
	it('German business stays domestic', () => {
		expect(determineTax(ctx, { country: 'DE', vatId: 'DE123456789', isBusiness: true }).treatment).toBe('standard');
	});
	it('reverse charge needs the business flag and the feature', () => {
		expect(determineTax(ctx, { country: 'FR', vatId: 'FR12345678901', isBusiness: false }).treatment).toBe('standard');
		expect(determineTax({ ...ctx, reverseChargeEnabled: false }, { country: 'FR', vatId: 'FR12345678901', isBusiness: true }).treatment).toBe('standard');
	});
	it('Greek VAT IDs use the EL prefix', () => {
		expect(determineTax(ctx, { country: 'GR', vatId: 'EL123456789', isBusiness: true }).treatment).toBe('reverse_charge');
	});
	it('non-EU customer → not taxable', () => {
		expect(determineTax(ctx, { country: 'US' })).toEqual({ treatment: 'third_country', rate: 0 });
		expect(determineTax(ctx, { country: 'CH' })).toEqual({ treatment: 'third_country', rate: 0 });
	});
	it('Spain counts as EU (was missing in the old checkout list)', () => {
		expect(determineTax(ctx, { country: 'ES' }).treatment).toBe('standard');
	});
	it('small business overrides everything', () => {
		expect(determineTax({ ...ctx, smallBusiness: true }, { country: 'FR', vatId: 'FR1', isBusiness: true })).toEqual({ treatment: 'small_business', rate: 0 });
	});
});

describe('amounts', () => {
	it('splitGross always adds up', () => {
		for (const gross of [1, 99, 100, 119, 4999, 29900, 123457]) {
			for (const rate of [0, 7, 19, 20, 21]) {
				const { netCents, vatCents } = splitGross(gross, rate);
				expect(netCents + vatCents).toBe(gross);
			}
		}
		expect(splitGross(11900, 19)).toEqual({ netCents: 10000, vatCents: 1900 });
		expect(splitGross(-11900, 19)).toEqual({ netCents: -10000, vatCents: -1900 });
	});
	it('reverse charge customers are charged the net price', () => {
		expect(chargeableAmount(11900, ctx, 'reverse_charge')).toBe(10000);
		expect(chargeableAmount(11900, ctx, 'third_country')).toBe(11900);
	});
});
