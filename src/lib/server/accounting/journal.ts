import type Stripe from 'stripe';
import { and, gte, lt, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { invoices } from '$lib/server/db/schema';
import { getStripeClient } from '$lib/server/stripe';
import { getStripeKey, getPayPalConfig, getSettings } from '$lib/server/settings';
import { listPayPalTransactions, type PayPalTransaction } from '$lib/server/paypal';
import { resolveAccounts, revenueAccount, type AccountMapping } from '$lib/accounting/accounts';

/**
 * Builds the bookings for a period from the actual money movements (Stripe balance
 * transactions, PayPal transactions) and reconciles every movement against its invoice.
 *
 * Bookings go through the provider's clearing account (Geldtransit): sales, refunds, fees and
 * chargebacks move it, the payouts imported from the bank statement empty it. Because every
 * booking comes from a real movement, the clearing account balances exactly when the bank
 * shows the payouts — and every reconciliation issue is listed before anything is exported.
 */

export type Invoice = typeof invoices.$inferSelect;

export interface Booking {
	date: Date;
	amountCents: number;        // always positive
	debit: string;              // Soll
	credit: string;             // Haben
	taxKey?: string;            // BU-Schlüssel
	documentNumber?: string;    // Belegfeld 1 (invoice / correction number)
	text: string;               // Buchungstext
	euVatIdOrCountry?: string;  // EU-Land u. UStID (Bestimmung)
	euTaxRate?: number;         // EU-Steuersatz (Bestimmung)
	serviceDate?: Date;
	reference: string;          // provider transaction id
}

export type MovementType = 'sale' | 'refund' | 'fee' | 'chargeback' | 'payout' | 'other';

export interface Movement {
	provider: 'stripe' | 'paypal';
	id: string;
	type: MovementType;
	date: Date;
	amountCents: number;  // signed gross movement
	feeCents: number;     // signed (negative = fee charged)
	netCents: number;
	documentNumber?: string;
	status: 'ok' | 'mismatch' | 'missing_document' | 'unassigned' | 'not_booked';
	note?: string;
}

export interface Issue {
	severity: 'error' | 'warning';
	message: string;
}

export interface ProviderTotals {
	sales: number;
	refunds: number;
	fees: number;
	chargebacks: number;
	other: number;
	payouts: number;
	/** Change of the provider balance without payouts = what the clearing account must show */
	netBeforePayouts: number;
}

export interface JournalResult {
	from: Date;
	to: Date;
	bookings: Booking[];
	movements: Movement[];
	issues: Issue[];
	totals: Record<'stripe' | 'paypal', ProviderTotals>;
	documents: Invoice[];
	accounts: AccountMapping;
}

// ── Period helpers (months are Europe/Berlin calendar months) ──────────────────

function berlinOffsetMinutes(date: Date): number {
	const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
		.formatToParts(date).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
	const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
	if (!m) return 60;
	const sign = m[1] === '-' ? -1 : 1;
	return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? '0', 10));
}

/** UTC instant of midnight Europe/Berlin at the start of the given month (month 1–12, may overflow). */
function berlinMonthStart(year: number, month: number): Date {
	const approx = new Date(Date.UTC(year, month - 1, 1));
	return new Date(approx.getTime() - berlinOffsetMinutes(approx) * 60_000);
}

export function monthRange(ym: string): { from: Date; to: Date } {
	const [y, m] = ym.split('-').map((n) => parseInt(n, 10));
	if (!y || !m || m < 1 || m > 12) throw new Error(`Ungültiger Monat: ${ym}`);
	return { from: berlinMonthStart(y, m), to: berlinMonthStart(y, m + 1) };
}

// ── Journal ────────────────────────────────────────────────────────────────────

const emptyTotals = (): ProviderTotals => ({ sales: 0, refunds: 0, fees: 0, chargebacks: 0, other: 0, payouts: 0, netBeforePayouts: 0 });

export async function buildJournal(from: Date, to: Date): Promise<JournalResult> {
	const settings = await getSettings();
	const accounts = resolveAccounts(settings?.datevChartOfAccounts, settings?.datevAccounts);

	const bookings: Booking[] = [];
	const movements: Movement[] = [];
	const issues: Issue[] = [];
	const totals = { stripe: emptyTotals(), paypal: emptyTotals() };
	const usedDocs = new Map<string, Invoice>();

	// ── 1. Fetch all money movements of the period ──
	const stripeKey = await getStripeKey();
	const stripeTxns: Stripe.BalanceTransaction[] = [];
	if (stripeKey) {
		const stripe = getStripeClient(stripeKey);
		const list = stripe.balanceTransactions.list({
			created: { gte: Math.floor(from.getTime() / 1000), lt: Math.floor(to.getTime() / 1000) },
			limit: 100,
			expand: ['data.source'],
		});
		for await (const bt of list as AsyncIterable<Stripe.BalanceTransaction>) stripeTxns.push(bt);
	}

	const paypal = await getPayPalConfig();
	let paypalTxns: PayPalTransaction[] = [];
	if (paypal) {
		try {
			paypalTxns = await listPayPalTransactions(paypal, from, to);
		} catch (err: any) {
			issues.push({ severity: 'error', message: `PayPal-Umsätze konnten nicht abgerufen werden (${err?.message ?? err}). In der PayPal-App muss „Transaction search“ aktiviert sein.` });
		}
	}

	// ── 2. Load the documents they reference, in one query ──
	const idOf = (v: any): string | null => (!v ? null : typeof v === 'string' ? v : (v.id ?? null));
	const stripeRef = (bt: Stripe.BalanceTransaction): string | null => {
		const source: any = bt.source;
		return bt.reporting_category === 'refund' || bt.reporting_category === 'partial_capture_reversal'
			? idOf(source)
			: idOf(source?.payment_intent);
	};
	const refs = [
		...stripeTxns.map(stripeRef),
		...paypalTxns.flatMap((t) => [t.id, t.referenceId]),
	].filter((r): r is string => !!r);
	const docsByRef = new Map<string, Invoice>();
	if (refs.length > 0) {
		const rows = await db.select().from(invoices).where(inArray(invoices.paymentReference, [...new Set(refs)]));
		for (const row of rows) if (row.paymentReference) docsByRef.set(row.paymentReference, row);
	}
	const docFor = (ref: string | null | undefined): Invoice | null => (ref ? docsByRef.get(ref) ?? null : null);

	/** Revenue (or its reversal for corrections) against the clearing account. */
	function bookRevenue(doc: Invoice | null, clearing: string, amountCents: number, date: Date, reference: string, label: string) {
		const treatment = doc?.taxTreatment ?? 'standard';
		const revenue = revenueAccount(accounts, treatment);
		if (!revenue) {
			issues.push({ severity: 'error', message: `Kein Erlöskonto für Steuerart „${treatment}" hinterlegt (Einstellungen → Buchhaltung) — ${label} ${doc?.invoiceNumber ?? reference}.` });
		}
		const incoming = amountCents > 0;
		bookings.push({
			date,
			amountCents: Math.abs(amountCents),
			debit: incoming ? clearing : revenue,
			credit: incoming ? revenue : clearing,
			documentNumber: doc?.invoiceNumber,
			text: `${label} ${doc?.customerName ?? ''}`.trim(),
			euVatIdOrCountry: treatment === 'reverse_charge' ? (doc?.customerVatId ?? undefined)
				: treatment === 'oss' ? (doc?.customerCountry ?? undefined) : undefined,
			euTaxRate: treatment === 'oss' ? doc?.vatRate : undefined,
			serviceDate: doc?.serviceDate ?? undefined,
			reference,
		});
		if (doc) usedDocs.set(doc.id, doc);
	}

	function bookFee(clearing: string, feeCents: number, date: Date, reference: string, label: string) {
		if (feeCents === 0) return;
		const charged = feeCents < 0; // negative = money leaves the provider balance
		bookings.push({
			date,
			amountCents: Math.abs(feeCents),
			debit: charged ? accounts.fees : clearing,
			credit: charged ? clearing : accounts.fees,
			taxKey: accounts.feesTaxKey || undefined,
			text: label,
			reference,
		});
	}

	function bookChargeback(clearing: string, amountCents: number, date: Date, reference: string, doc: Invoice | null) {
		const out = amountCents < 0;
		bookings.push({
			date,
			amountCents: Math.abs(amountCents),
			debit: out ? accounts.chargebackLoss : clearing,
			credit: out ? clearing : accounts.chargebackLoss,
			documentNumber: doc?.invoiceNumber,
			text: out ? 'Chargeback' : 'Chargeback gewonnen',
			reference,
		});
	}

	/** Compares a movement with its document and records the reconciliation status. */
	function reconcile(m: Movement, doc: Invoice | null, expectedSign: 1 | -1) {
		if (!doc) {
			m.status = 'missing_document';
			issues.push({ severity: 'error', message: `${m.provider === 'stripe' ? 'Stripe' : 'PayPal'}-${m.type === 'sale' ? 'Zahlung' : 'Erstattung'} ${m.id} über ${(m.amountCents / 100).toFixed(2)} € hat keine ${m.type === 'sale' ? 'Rechnung' : 'Rechnungskorrektur'}.` });
			return;
		}
		m.documentNumber = doc.invoiceNumber;
		if (doc.totalCents !== m.amountCents || Math.sign(m.amountCents) !== expectedSign) {
			m.status = 'mismatch';
			issues.push({ severity: 'error', message: `Betrag weicht ab: ${doc.invoiceNumber} lautet über ${(doc.totalCents / 100).toFixed(2)} €, die Zahlung ${m.id} über ${(m.amountCents / 100).toFixed(2)} €.` });
		}
	}

	// ── 3. Stripe ──
	{
		const clearing = accounts.clearingStripe;
		const t = totals.stripe;
		for (const bt of stripeTxns) {
			if (bt.currency !== 'eur') {
				issues.push({ severity: 'error', message: `Stripe-Bewegung ${bt.id} in ${bt.currency.toUpperCase()} — Fremdwährungen werden nicht automatisch gebucht.` });
				continue;
			}
			const date = new Date(bt.created * 1000);
			const m: Movement = {
				provider: 'stripe', id: bt.id, type: 'other', date,
				amountCents: bt.amount, feeCents: -bt.fee, netCents: bt.net, status: 'ok',
			};
			const category = bt.reporting_category;

			if (category === 'charge') {
				m.type = 'sale';
				const doc = docFor(stripeRef(bt));
				reconcile(m, doc, 1);
				bookRevenue(doc, clearing, bt.amount, date, bt.id, 'Kurs');
				bookFee(clearing, -bt.fee, date, bt.id, 'Stripe-Gebühr');
				t.sales += bt.amount;
			} else if (category === 'refund' || category === 'partial_capture_reversal') {
				m.type = 'refund';
				const doc = docFor(stripeRef(bt));
				reconcile(m, doc, -1);
				bookRevenue(doc, clearing, bt.amount, date, bt.id, 'Erstattung');
				bookFee(clearing, -bt.fee, date, bt.id, 'Stripe-Gebühr Erstattung');
				t.refunds += bt.amount;
			} else if (category === 'dispute' || category === 'dispute_reversal') {
				m.type = 'chargeback';
				const doc = docFor(stripeRef(bt));
				m.documentNumber = doc?.invoiceNumber;
				bookChargeback(clearing, bt.amount, date, bt.id, doc);
				bookFee(clearing, -bt.fee, date, bt.id, 'Stripe-Chargeback-Gebühr');
				t.chargebacks += bt.amount;
			} else if (category === 'payout' || category === 'payout_reversal') {
				m.type = 'payout';
				m.status = 'not_booked';
				m.note = 'Wird über den Kontoauszug gebucht (Bank an Geldtransit)';
				t.payouts += bt.amount;
			} else if (category === 'fee' || bt.type === 'stripe_fee') {
				m.type = 'fee';
				bookFee(clearing, bt.net, date, bt.id, 'Stripe-Gebühr');
			} else {
				m.status = 'unassigned';
				t.other += bt.net;
				issues.push({ severity: 'error', message: `Stripe-Bewegung ${bt.id} (${bt.type}, ${(bt.net / 100).toFixed(2)} €) konnte nicht automatisch zugeordnet werden — bitte manuell buchen.` });
			}
			t.fees += m.type === 'fee' ? bt.net : -bt.fee;
			if (m.type !== 'payout') t.netBeforePayouts += bt.net;
			movements.push(m);
		}
	}

	// ── 4. PayPal ──
	{
		const clearing = accounts.clearingPaypal;
		const t = totals.paypal;
		for (const tx of paypalTxns) {
			if (tx.status !== 'S') continue; // only completed movements change the balance
			if (tx.currency !== 'eur') {
				issues.push({ severity: 'error', message: `PayPal-Bewegung ${tx.id} in ${tx.currency.toUpperCase()} — Fremdwährungen werden nicht automatisch gebucht.` });
				continue;
			}
			const m: Movement = {
				provider: 'paypal', id: tx.id, type: 'other', date: tx.date,
				amountCents: tx.amountCents, feeCents: tx.feeCents, netCents: tx.amountCents + tx.feeCents, status: 'ok',
			};
			const code = tx.eventCode;

			if (code.startsWith('T00') && tx.amountCents > 0) {
				m.type = 'sale';
				const doc = docFor(tx.id);
				reconcile(m, doc, 1);
				bookRevenue(doc, clearing, tx.amountCents, tx.date, tx.id, 'Kurs');
				bookFee(clearing, tx.feeCents, tx.date, tx.id, 'PayPal-Gebühr');
				t.sales += tx.amountCents;
			} else if (code === 'T1107') {
				m.type = 'refund';
				const doc = docFor(tx.id);
				reconcile(m, doc, -1);
				bookRevenue(doc, clearing, tx.amountCents, tx.date, tx.id, 'Erstattung');
				bookFee(clearing, tx.feeCents, tx.date, tx.id, 'PayPal-Gebühr Erstattung');
				t.refunds += tx.amountCents;
			} else if (code.startsWith('T11') || code.startsWith('T12')) {
				m.type = 'chargeback';
				const doc = docFor(tx.referenceId);
				m.documentNumber = doc?.invoiceNumber;
				bookChargeback(clearing, tx.amountCents, tx.date, tx.id, doc);
				bookFee(clearing, tx.feeCents, tx.date, tx.id, 'PayPal-Gebühr Rückbuchung');
				t.chargebacks += tx.amountCents;
			} else if (code.startsWith('T04')) {
				m.type = 'payout';
				m.status = 'not_booked';
				m.note = 'Wird über den Kontoauszug gebucht (Bank an Geldtransit)';
				t.payouts += tx.amountCents;
			} else if (code.startsWith('T01') || code.startsWith('T05')) {
				m.type = 'fee';
				bookFee(clearing, tx.amountCents + tx.feeCents, tx.date, tx.id, 'PayPal-Gebühr');
			} else if (tx.amountCents + tx.feeCents !== 0) {
				m.status = 'unassigned';
				t.other += m.netCents;
				issues.push({ severity: 'error', message: `PayPal-Bewegung ${tx.id} (Code ${code}, ${(m.netCents / 100).toFixed(2)} €) konnte nicht automatisch zugeordnet werden — bitte manuell buchen.` });
			} else {
				continue; // holds/releases etc. without balance effect
			}
			t.fees += m.type === 'fee' ? m.netCents : tx.feeCents;
			if (m.type !== 'payout') t.netBeforePayouts += m.netCents;
			movements.push(m);
		}
	}

	// ── Documents without a money movement in this period ──
	const periodDocs = await db.select().from(invoices).where(and(gte(invoices.invoiceDate, from), lt(invoices.invoiceDate, to)));
	const movedRefs = new Set(movements.map((m) => m.documentNumber).filter(Boolean));
	for (const doc of periodDocs) {
		if (!doc.paymentReference) {
			issues.push({ severity: 'warning', message: `${doc.invoiceNumber} wurde vor der Umstellung erstellt (ohne Zahlungsreferenz) und kann nicht automatisch abgeglichen werden.` });
			continue;
		}
		if (!movedRefs.has(doc.invoiceNumber)) {
			issues.push({ severity: 'warning', message: `${doc.invoiceNumber} (${(doc.totalCents / 100).toFixed(2)} €) hat im Zeitraum keine Geldbewegung — ggf. im Nachbarmonat verbucht oder Zahlung noch in Bearbeitung.` });
		}
		usedDocs.set(doc.id, doc);
	}

	// ── Self-check: bookings on the clearing accounts must equal the provider balance change ──
	for (const provider of ['stripe', 'paypal'] as const) {
		const clearing = provider === 'stripe' ? accounts.clearingStripe : accounts.clearingPaypal;
		const shared = accounts.clearingStripe === accounts.clearingPaypal;
		if (shared && provider === 'paypal') break;
		const booked = bookings.reduce((s, b) => s + (b.debit === clearing ? b.amountCents : 0) - (b.credit === clearing ? b.amountCents : 0), 0);
		const expected = shared ? totals.stripe.netBeforePayouts + totals.paypal.netBeforePayouts - totals.stripe.other - totals.paypal.other
			: totals[provider].netBeforePayouts - totals[provider].other;
		if (booked !== expected) {
			issues.push({ severity: 'error', message: `Interne Prüfung: Buchungen auf Konto ${clearing} (${(booked / 100).toFixed(2)} €) ≠ Saldoänderung beim Zahlungsanbieter (${(expected / 100).toFixed(2)} €).` });
		}
	}

	bookings.sort((a, b) => a.date.getTime() - b.date.getTime());
	movements.sort((a, b) => a.date.getTime() - b.date.getTime());
	return { from, to, bookings, movements, issues, totals, documents: [...usedDocs.values()], accounts };
}
