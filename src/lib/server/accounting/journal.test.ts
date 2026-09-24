import { describe, it, expect, vi } from 'vitest';

// A month of money movements and the documents the platform issued for them
const inv = (o: Record<string, unknown>) => ({
	id: o.invoiceNumber, kind: 'invoice', taxTreatment: 'standard', vatRate: 19, customerName: 'Kunde',
	customerVatId: null, customerCountry: 'DE', serviceDate: null, pdfBase64: null,
	invoiceDate: new Date('2026-09-10T10:00:00Z'), correctsInvoiceId: null, ...o,
});
const docs = [
	inv({ invoiceNumber: 'INV-2026-0001', paymentReference: 'pi_1', totalCents: 29900 }),
	inv({ invoiceNumber: 'INV-2026-0002', paymentReference: 'pi_2', totalCents: 12000, taxTreatment: 'reverse_charge', vatRate: 0, customerVatId: 'FR12345678901', customerCountry: 'FR' }),
	inv({ invoiceNumber: 'INV-2026-0003', paymentReference: 're_1', totalCents: -29900, kind: 'correction' }),
	inv({ invoiceNumber: 'INV-2026-0004', paymentReference: 'CAP1', totalCents: 9900 }),
	inv({ invoiceNumber: 'INV-2026-0005', paymentReference: 'REF1', totalCents: -9900, kind: 'correction' }),
	inv({ invoiceNumber: 'INV-2026-0006', paymentReference: 'pi_4', totalCents: 5000 }), // amount will not match
];
const at = (day: number) => Math.floor(new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00Z`).getTime() / 1000);
const bt = (o: Record<string, unknown>) => ({ currency: 'eur', fee: 0, ...o });
const stripeTxns = [
	bt({ id: 'txn_1', created: at(1), amount: 29900, fee: 450, net: 29450, reporting_category: 'charge', type: 'charge', source: { payment_intent: 'pi_1' } }),
	bt({ id: 'txn_2', created: at(2), amount: 12000, fee: 200, net: 11800, reporting_category: 'charge', type: 'charge', source: { payment_intent: 'pi_2' } }),
	bt({ id: 'txn_3', created: at(3), amount: -29900, net: -29900, reporting_category: 'refund', type: 'refund', source: { id: 're_1' } }),
	bt({ id: 'txn_4', created: at(4), amount: -12000, fee: 1500, net: -13500, reporting_category: 'dispute', type: 'adjustment', source: { payment_intent: 'pi_2' } }),
	bt({ id: 'txn_5', created: at(5), amount: -500, net: -500, reporting_category: 'fee', type: 'stripe_fee', source: null }),
	bt({ id: 'txn_6', created: at(6), amount: 5000, fee: 100, net: 4900, reporting_category: 'charge', type: 'charge', source: { payment_intent: 'pi_3' } }), // no invoice
	bt({ id: 'txn_7', created: at(7), amount: 4000, fee: 100, net: 3900, reporting_category: 'charge', type: 'charge', source: { payment_intent: 'pi_4' } }), // invoice says 50,00
	bt({ id: 'txn_8', created: at(8), amount: -10000, net: -10000, reporting_category: 'payout', type: 'payout', source: { id: 'po_1' } }),
];
const paypalTxns = [
	{ id: 'CAP1', referenceId: null, eventCode: 'T0006', status: 'S', date: new Date('2026-09-11T12:00:00Z'), amountCents: 9900, feeCents: -380, currency: 'eur' },
	{ id: 'REF1', referenceId: 'CAP1', eventCode: 'T1107', status: 'S', date: new Date('2026-09-12T12:00:00Z'), amountCents: -9900, feeCents: 0, currency: 'eur' },
	{ id: 'WD1', referenceId: null, eventCode: 'T0400', status: 'S', date: new Date('2026-09-13T12:00:00Z'), amountCents: -2000, feeCents: 0, currency: 'eur' },
	{ id: 'PEND', referenceId: null, eventCode: 'T0006', status: 'P', date: new Date('2026-09-14T12:00:00Z'), amountCents: 777, feeCents: 0, currency: 'eur' },
];

vi.mock('$lib/server/db', () => ({
	db: { select: () => ({ from: () => ({ where: async () => docs }) }) },
}));
vi.mock('$lib/server/settings', () => ({
	getSettings: async () => ({ datevChartOfAccounts: 'SKR03', datevAccounts: JSON.stringify({ clearingPaypal: '1361' }) }),
	getStripeKey: async () => 'sk_test',
	getPayPalConfig: async () => ({ clientId: 'x', clientSecret: 'y', sandbox: true, webhookId: null }),
}));
vi.mock('$lib/server/stripe', () => ({
	getStripeClient: () => ({
		balanceTransactions: {
			list: () => ({ async *[Symbol.asyncIterator]() { yield* stripeTxns; } }),
		},
	}),
}));
vi.mock('$lib/server/paypal', () => ({ listPayPalTransactions: async () => paypalTxns }));

const { buildJournal, monthRange } = await import('./journal');

describe('buildJournal', async () => {
	const { from, to } = monthRange('2026-09');
	const j = await buildJournal(from, to);
	const clearingDelta = (account: string) =>
		j.bookings.reduce((s, b) => s + (b.debit === account ? b.amountCents : 0) - (b.credit === account ? b.amountCents : 0), 0);

	it('uses Berlin month boundaries', () => {
		expect(from.toISOString()).toBe('2026-08-31T22:00:00.000Z');
		expect(to.toISOString()).toBe('2026-09-30T22:00:00.000Z');
	});

	it('Stripe clearing account moves exactly by the balance change before payouts', () => {
		// net of all non-payout movements: 29450 + 11800 − 29900 − 13500 − 500 + 4900 + 3900
		expect(clearingDelta('1360')).toBe(6150);
		expect(j.totals.stripe.netBeforePayouts).toBe(6150);
		expect(j.totals.stripe.payouts).toBe(-10000);
	});

	it('PayPal on its own clearing account', () => {
		expect(clearingDelta('1361')).toBe(9900 - 380 - 9900);
		expect(j.totals.paypal.payouts).toBe(-2000);
	});

	it('books revenue to the account of the tax treatment', () => {
		const rc = j.bookings.find((b) => b.documentNumber === 'INV-2026-0002' && b.credit === '8336');
		expect(rc?.amountCents).toBe(12000);
		expect(rc?.euVatIdOrCountry).toBe('FR12345678901');
		const std = j.bookings.find((b) => b.documentNumber === 'INV-2026-0001');
		expect(std).toMatchObject({ debit: '1360', credit: '8400', amountCents: 29900 });
		const refund = j.bookings.find((b) => b.documentNumber === 'INV-2026-0003');
		expect(refund).toMatchObject({ debit: '8400', credit: '1360', amountCents: 29900 });
	});

	it('books fees and chargebacks', () => {
		expect(j.bookings.filter((b) => b.debit === '4970').reduce((s, b) => s + b.amountCents, 0)).toBe(450 + 200 + 1500 + 500 + 100 + 100 + 380);
		expect(j.bookings.find((b) => b.debit === '2400')?.amountCents).toBe(12000);
	});

	it('does not book payouts or pending PayPal movements', () => {
		expect(j.bookings.some((b) => b.reference === 'txn_8' || b.reference === 'WD1' || b.reference === 'PEND')).toBe(false);
		expect(j.movements.find((m) => m.id === 'txn_8')?.status).toBe('not_booked');
	});

	it('reports exactly the two real problems', () => {
		const errors = j.issues.filter((i) => i.severity === 'error').map((i) => i.message);
		expect(errors).toHaveLength(2);
		expect(errors.some((e) => e.includes('txn_6') && e.includes('keine Rechnung'))).toBe(true);
		expect(errors.some((e) => e.includes('INV-2026-0006') && e.includes('Betrag weicht ab'))).toBe(true);
		expect(j.movements.find((m) => m.id === 'txn_6')?.status).toBe('missing_document');
		expect(j.movements.find((m) => m.id === 'txn_7')?.status).toBe('mismatch');
	});
});
