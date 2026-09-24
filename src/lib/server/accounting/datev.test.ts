import { describe, it, expect } from 'vitest';
import { buildDatevBuchungsstapel } from './datev';
import { renderInvoicePdf } from '../invoicePdf';
import type { Booking } from './journal';

const decode = (bytes: Uint8Array) => new TextDecoder('windows-1252').decode(bytes);

describe('DATEV Buchungsstapel', () => {
	const bookings: Booking[] = [
		{
			date: new Date('2026-09-14T22:30:00Z'), // 15.09. in Berlin
			amountCents: 29900, debit: '1360', credit: '8400',
			documentNumber: 'INV-2026-0042', text: 'Kurs Müller "Test"', reference: 'txn_123',
			serviceDate: new Date('2026-09-14T22:30:00Z'),
		},
		{
			date: new Date('2026-09-20T10:00:00Z'),
			amountCents: 12000, debit: '1360', credit: '8336',
			documentNumber: 'INV_2026_0043', text: 'Kurs', reference: 'txn_456', euVatIdOrCountry: 'FR12345678901',
		},
	];
	const file = decode(buildDatevBuchungsstapel({
		consultantNumber: '1234567', clientNumber: '10001', fiscalYearStart: new Date('2025-12-31T23:00:00Z'),
		accountLength: 4, chart: 'SKR03', from: new Date('2026-08-31T22:00:00Z'), to: new Date('2026-09-30T21:59:59Z'),
		label: 'Online-Umsätze 2026-09',
	}, bookings));
	const lines = file.split('\r\n').filter(Boolean);

	it('has header, column row and one row per booking', () => {
		expect(lines).toHaveLength(4);
		expect(lines[0].startsWith('"EXTF";700;21;"Buchungsstapel";13;')).toBe(true);
		expect(lines[0]).toContain(';1234567;10001;20260101;4;20260901;20260930;');
		expect(lines[0]).toContain('"03"');
	});
	it('every row has the same 125 columns as the column header', () => {
		expect(lines[1].split(';')).toHaveLength(125);
		expect(lines[2].split(';')).toHaveLength(125);
	});
	it('formats amounts, Berlin-local dates and quoting per DATEV', () => {
		const cells = lines[2].split(';');
		expect(cells[0]).toBe('299,00');
		expect(cells[1]).toBe('"S"');
		expect(cells[6]).toBe('1360');
		expect(cells[7]).toBe('8400');
		expect(cells[9]).toBe('1509');                 // Belegdatum DDMM in Europe/Berlin
		expect(cells[10]).toBe('"INV-2026-0042"');
		expect(cells[13]).toBe('"Kurs Müller ""Test"""');
		expect(cells[114]).toBe('15092026');           // Leistungsdatum
	});
	it('strips characters DATEV forbids in Belegfeld 1 and sets the EU VAT ID', () => {
		const cells = lines[3].split(';');
		expect(cells[10]).toBe('"INV20260043"');
		expect(cells[39]).toBe('"FR12345678901"');
	});
	it('is Windows-1252 encoded (umlauts as single bytes)', () => {
		const bytes = buildDatevBuchungsstapel({
			consultantNumber: '1', clientNumber: '1', fiscalYearStart: new Date(), accountLength: 4, chart: 'SKR04',
			from: new Date(), to: new Date(), label: 'ä€',
		}, []);
		expect(Array.from(bytes)).toContain(0xe4); // ä
		expect(Array.from(bytes)).toContain(0x80); // €
	});
});

describe('invoice PDF', () => {
	it('renders a valid PDF', async () => {
		const pdf = await renderInvoicePdf({
			kind: 'invoice', documentTitle: 'Rechnung', invoiceNumber: 'INV-2026-0001', invoiceDate: '24.09.2026',
			serviceDate: '24.09.2026', referenceNote: '', taxNote: '', paymentNote: 'Der Betrag wurde am 24.09.2026 über Stripe bezahlt.',
			companyName: 'Lumière GmbH', companyAddress: 'Musterstraße 1<br>10115 Berlin<br>DE', companyVatId: 'DE123456789',
			companyTaxNumber: '', companyLegal: 'Geschäftsführung: Maria Muster · Amtsgericht Berlin HRB 1', companyEmail: 'a@b.de', companyPhone: '',
			customerName: 'Max Müller', customerEmail: 'max@example.com', customerAddress: 'Weg 2<br>80331 München<br>DE', customerVatId: '',
			items: [{ description: 'Hautpflege Masterclass', quantity: 1, unitPriceCents: 25126, totalCents: 25126, grossCents: 29900 }],
			subtotalCents: 25126, vatRate: 19, vatCents: 4774, totalCents: 29900, currency: 'eur',
			taxTreatment: 'standard', isReverseCharge: false, notes: '',
		});
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		expect(pdf.length).toBeGreaterThan(1000);
	});
});
