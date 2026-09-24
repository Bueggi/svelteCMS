import { zipSync, strToU8 } from 'fflate';
import { getSettings } from '$lib/server/settings';
import { buildJournal, monthRange, type JournalResult } from './journal';
import { buildDatevBuchungsstapel } from './datev';
import { ACCOUNT_LABELS, type AccountMapping } from '$lib/accounting/accounts';

type Settings = NonNullable<Awaited<ReturnType<typeof getSettings>>>;

const TREATMENT_LABEL: Record<string, string> = {
	standard: 'Inland',
	oss: 'OSS (EU-Privatkunde)',
	reverse_charge: 'Reverse Charge (EU-B2B)',
	third_country: 'Drittland',
	small_business: 'Kleinunternehmer',
};

/** Settings that must be filled in before a DATEV export makes sense. */
export function missingDatevSettings(s: Settings | null, accounts: AccountMapping): string[] {
	const missing: string[] = [];
	if (!s?.datevConsultantNumber) missing.push('DATEV-Beraternummer');
	if (!s?.datevClientNumber) missing.push('DATEV-Mandantennummer');
	if (!s?.companyName) missing.push('Firmenname');
	if (!s?.companyVatId && !s?.companyTaxNumber) missing.push('USt-IdNr. oder Steuernummer');
	for (const key of ['revenueStandard', 'clearingStripe', 'clearingPaypal', 'fees', 'chargebackLoss'] as const) {
		if (!accounts[key]) missing.push(`Konto „${ACCOUNT_LABELS[key]}“`);
	}
	if (s?.ossEnabled && !accounts.revenueOss) missing.push(`Konto „${ACCOUNT_LABELS.revenueOss}“`);
	return missing;
}

const euro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const csvCell = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = (rows: (string | number | null | undefined)[][]) =>
	'﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n'; // BOM for Excel
const date = (d: Date | null | undefined) => (d ? d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : '');

const MOVEMENT_TYPE: Record<string, string> = {
	sale: 'Zahlung', refund: 'Erstattung', fee: 'Gebühr', chargeback: 'Chargeback', payout: 'Auszahlung', other: 'Sonstiges',
};
const MOVEMENT_STATUS: Record<string, string> = {
	ok: 'OK', mismatch: 'BETRAG WEICHT AB', missing_document: 'BELEG FEHLT', unassigned: 'NICHT ZUGEORDNET', not_booked: 'über Bankauszug',
};

function fiscalYearStart(periodStart: Date, startMonth: number): Date {
	const berlin = new Date(periodStart.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
	let year = berlin.getFullYear();
	if (berlin.getMonth() + 1 < startMonth) year -= 1;
	return monthRange(`${year}-${String(startMonth).padStart(2, '0')}`).from;
}

export async function buildMonthlyExport(month: string): Promise<{ zip: Uint8Array; filename: string; journal: JournalResult }> {
	const { from, to } = monthRange(month);
	const settings = await getSettings();
	const journal = await buildJournal(from, to);
	const lastDay = new Date(to.getTime() - 1);

	const files: Record<string, Uint8Array> = {};

	// 1. DATEV Buchungsstapel
	files[`EXTF_Buchungsstapel_${month}.csv`] = buildDatevBuchungsstapel({
		consultantNumber: settings?.datevConsultantNumber ?? '',
		clientNumber: settings?.datevClientNumber ?? '',
		fiscalYearStart: fiscalYearStart(from, settings?.datevFiscalYearStartMonth ?? 1),
		accountLength: settings?.datevAccountLength ?? 4,
		chart: settings?.datevChartOfAccounts === 'SKR04' ? 'SKR04' : 'SKR03',
		from,
		to: lastDay,
		label: `Online-Umsätze ${month}`,
	}, journal.bookings);

	// 2. Documents (PDFs as sent to the customer)
	for (const doc of journal.documents) {
		if (doc.pdfBase64) {
			files[`Belege/${doc.invoiceNumber}.pdf`] = Uint8Array.from(Buffer.from(doc.pdfBase64, 'base64'));
		}
	}

	// 3. Rechnungsausgangsbuch
	const docs = [...journal.documents].sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));
	files[`Rechnungsausgangsbuch_${month}.csv`] = strToU8(csv([
		['Nummer', 'Art', 'Rechnungsdatum', 'Leistungsdatum', 'Kunde', 'Land', 'USt-IdNr. Kunde', 'Steuerart', 'Netto', 'USt-Satz', 'USt', 'Brutto', 'Korrigiert Rechnung', 'Zahlungsanbieter', 'Zahlungsreferenz', 'SHA-256 PDF'],
		...docs.map((d) => [
			d.invoiceNumber,
			d.kind === 'correction' ? 'Rechnungskorrektur' : 'Rechnung',
			date(d.invoiceDate), date(d.serviceDate), d.customerName, d.customerCountry, d.customerVatId,
			TREATMENT_LABEL[d.taxTreatment] ?? d.taxTreatment,
			euro(d.subtotalCents), d.vatRate, euro(d.vatCents), euro(d.totalCents),
			d.correctsInvoiceId ? docs.find((o) => o.id === d.correctsInvoiceId)?.invoiceNumber ?? d.correctsInvoiceId : '',
			d.paymentProvider, d.paymentReference, d.contentHash,
		]),
	]));

	// 4. Abgleich: every money movement with its document
	files[`Abgleich_${month}.csv`] = strToU8(csv([
		['Datum', 'Anbieter', 'Bewegung', 'Typ', 'Betrag', 'Gebühr', 'Netto', 'Beleg', 'Status', 'Hinweis'],
		...journal.movements.map((m) => [
			date(m.date), m.provider === 'stripe' ? 'Stripe' : 'PayPal', m.id, MOVEMENT_TYPE[m.type],
			euro(m.amountCents), euro(m.feeCents), euro(m.netCents), m.documentNumber, MOVEMENT_STATUS[m.status], m.note,
		]),
	]));

	// 5. Summary for the tax advisor
	const t = journal.totals;
	const block = (name: string, x: typeof t.stripe) => [
		`${name}`,
		`  Zahlungseingänge (brutto):   ${euro(x.sales)} €`,
		`  Erstattungen:                ${euro(x.refunds)} €`,
		`  Chargebacks:                 ${euro(x.chargebacks)} €`,
		`  Gebühren:                    ${euro(x.fees)} €`,
		`  Nicht zugeordnet:            ${euro(x.other)} €`,
		`  = Saldoänderung vor Auszahl.: ${euro(x.netBeforePayouts)} €`,
		`  Auszahlungen auf das Bankkonto: ${euro(x.payouts)} € (über den Kontoauszug zu buchen)`,
	].join('\r\n');
	const a = journal.accounts;
	const summary = [
		`Buchhaltungsexport ${month} — ${settings?.companyName ?? settings?.appName ?? ''}`,
		`Zeitraum: ${date(from)} – ${date(lastDay)} · erstellt am ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`,
		'',
		'Inhalt',
		`  EXTF_Buchungsstapel_${month}.csv   Buchungsstapel im DATEV-Format (${journal.bookings.length} Buchungen)`,
		`  Belege/                          ${journal.documents.filter((d) => d.pdfBase64).length} Rechnungen/Korrekturen als PDF (Dateiname = Belegfeld 1)`,
		`  Rechnungsausgangsbuch_${month}.csv Alle Belege mit Steuerart, Beträgen und SHA-256-Prüfsumme`,
		`  Abgleich_${month}.csv              Jede Geldbewegung mit zugehörigem Beleg`,
		'',
		'Buchungslogik',
		`  Zahlungen und Erstattungen werden über die Geldtransitkonten gebucht (Stripe ${a.clearingStripe}, PayPal ${a.clearingPaypal}).`,
		`  Gebühren: ${a.fees}${a.feesTaxKey ? ` (BU ${a.feesTaxKey})` : ''}, Chargebacks: ${a.chargebackLoss}.`,
		'  Die Auszahlungen an die Bank sind NICHT enthalten — sie kommen über den Kontoauszug (Bank an Geldtransit).',
		'  Danach ist das Geldtransitkonto ausgeglichen, wenn Buchungen und Auszahlungen übereinstimmen.',
		'',
		block('Stripe', t.stripe),
		'',
		block('PayPal', t.paypal),
		'',
		journal.issues.length === 0 ? 'Abgleich: keine Abweichungen.' : `Abgleich: ${journal.issues.length} Hinweis(e):`,
		...journal.issues.map((i) => `  [${i.severity === 'error' ? 'FEHLER' : 'Hinweis'}] ${i.message}`),
	].join('\r\n');
	files['Zusammenfassung.txt'] = strToU8('﻿' + summary + '\r\n');

	return { zip: zipSync(files, { level: 6 }), filename: `Buchhaltung_${month}.zip`, journal };
}
