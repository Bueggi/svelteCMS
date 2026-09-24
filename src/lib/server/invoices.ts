/**
 * Invoice service
 * - Issues invoices and corrections (Rechnungskorrektur) with sequential numbers, atomically
 * - One invoice per payment: every document carries the payment reference it belongs to,
 *   which is what ties invoices, the DATEV export and the money movements together
 * - Documents are immutable once issued (GoBD): HTML + PDF are rendered once, the PDF is
 *   stored with its SHA-256; template changes only affect new invoices
 */
import { createHash } from 'node:crypto';
import { db } from './db';
import { invoices, siteSettings, user } from './db/schema';
import { eq, sql, desc, asc } from 'drizzle-orm';
import { DEFAULT_INVOICE_TEMPLATE } from './invoiceTemplate';
import { renderInvoicePdf } from './invoicePdf';
import { sendMail } from './email/mailer';
import { splitGross, taxNote, type TaxTreatment } from '$lib/tax';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InvoiceItem {
	description: string;
	quantity: number;
	unitPriceCents: number; // net
	totalCents: number;     // net
	grossCents?: number;    // missing on invoices issued before the rework
}

export interface InvoiceRenderData {
	kind: 'invoice' | 'correction';
	documentTitle: string;
	invoiceNumber: string;
	invoiceDate: string;
	serviceDate: string;
	referenceNote: string;
	taxNote: string;
	paymentNote: string;
	// Company
	companyName: string;
	companyAddress: string;
	companyVatId: string;
	companyTaxNumber: string;
	companyLegal: string;
	companyEmail: string;
	companyPhone: string;
	// Customer
	customerName: string;
	customerEmail: string;
	customerAddress: string;
	customerVatId: string;
	// Financials
	items: InvoiceItem[];
	subtotalCents: number;
	vatRate: number;
	vatCents: number;
	totalCents: number;
	currency: string;
	taxTreatment: TaxTreatment;
	isReverseCharge: boolean;
	// Footer
	notes: string;
}

export interface CustomerAddress {
	line1?: string;
	line2?: string;
	postal_code?: string;
	city?: string;
	country?: string;
}

export interface CustomerSnapshot {
	name: string;
	email: string;
	address: CustomerAddress;
	vatId?: string | null;
}

export interface IssueInvoiceInput {
	kind: 'invoice' | 'correction';
	type: 'one_time' | 'subscription' | 'installment';
	userId: string;
	purchaseId?: string | null;
	corrects?: { id: string; invoiceNumber: string; invoiceDate: Date } | null;
	customer: CustomerSnapshot;
	taxTreatment: TaxTreatment;
	vatRate: number;
	/** Gross amounts actually paid (negative for corrections); they add up to the payment amount */
	lines: { description: string; grossCents: number }[];
	currency?: string;
	paymentProvider: 'stripe' | 'paypal';
	/** Unique per payment/refund (Stripe PaymentIntent/refund id, PayPal capture/refund id) */
	paymentReference: string;
	/** Stripe checkout session or subscription id, PayPal order id */
	orderReference?: string | null;
	paidAt: Date;
	serviceDate?: Date;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function formatCents(cents: number): string {
	return (cents / 100).toLocaleString('de-DE', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function currencySymbol(currency: string): string {
	return currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase();
}

function formatDate(date: Date): string {
	return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
}

const PROVIDER_LABEL: Record<string, string> = { stripe: 'Stripe', paypal: 'PayPal' };

function addressHtml(addr: CustomerAddress): string {
	return [
		addr.line1,
		addr.line2,
		[addr.postal_code, addr.city].filter(Boolean).join(' '),
		addr.country,
	]
		.filter(Boolean)
		.map((l) => escapeHtml(String(l)))
		.join('<br>');
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

type SettingsRow = typeof siteSettings.$inferSelect;

function companyData(settings: SettingsRow) {
	return {
		companyName: settings.companyName ?? settings.appName,
		companyAddress: [
			settings.companyStreet,
			[settings.companyZip, settings.companyCity].filter(Boolean).join(' '),
			settings.companyCountry,
		]
			.filter(Boolean)
			.map((l) => escapeHtml(String(l)))
			.join('<br>'),
		companyVatId: settings.companyVatId ?? '',
		companyTaxNumber: settings.companyTaxNumber ?? '',
		companyLegal: [
			settings.companyManagingDirector ? `Geschäftsführung: ${settings.companyManagingDirector}` : '',
			settings.companyRegister ?? '',
		]
			.filter(Boolean)
			.join(' · '),
		companyEmail: settings.companyEmail ?? '',
		companyPhone: settings.companyPhone ?? '',
	};
}

// ── HTML rendering ─────────────────────────────────────────────────────────────

export function renderInvoiceHtml(data: InvoiceRenderData, template?: string | null): string {
	const tpl = template || DEFAULT_INVOICE_TEMPLATE;
	const sym = currencySymbol(data.currency);

	const itemsRows = data.items
		.map(
			(item) => `
    <tr>
      <td class="item-desc">${escapeHtml(item.description)}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${sym}${formatCents(item.unitPriceCents)}</td>
      <td style="text-align:right">${sym}${formatCents(item.totalCents)}</td>
    </tr>`
		)
		.join('');

	const vatLabel: Record<TaxTreatment, string> = {
		standard: `MwSt. (${data.vatRate} %)`,
		oss: `MwSt. (${data.vatRate} %)`,
		reverse_charge: 'MwSt. (0 % — Reverse Charge)',
		third_country: 'MwSt. (0 % — nicht steuerbar)',
		small_business: 'Keine MwSt. (§ 19 UStG)',
	};
	const vatRow = `<div class="totals-row"><span>${vatLabel[data.taxTreatment]}</span><span>${sym}${formatCents(data.vatCents)}</span></div>`;

	const reverseChargeRow = data.isReverseCharge
		? `<div class="totals-row reverse-charge"><span>Steuerschuldnerschaft des Leistungsempfängers (§13b UStG)</span></div>`
		: '';

	const customerVatIdRow = data.customerVatId ? `<br>USt-IdNr.: ${escapeHtml(data.customerVatId)}` : '';

	const vars: Record<string, string> = {
		document_title: escapeHtml(data.documentTitle),
		invoice_number: escapeHtml(data.invoiceNumber),
		invoice_date: escapeHtml(data.invoiceDate),
		service_date: escapeHtml(data.serviceDate),
		reference_note: escapeHtml(data.referenceNote),
		tax_note: escapeHtml(data.taxNote),
		payment_note: escapeHtml(data.paymentNote),
		company_name: escapeHtml(data.companyName),
		company_address: data.companyAddress,
		company_vat_id: data.companyVatId ? `USt-IdNr.: ${escapeHtml(data.companyVatId)}` : '',
		company_tax_number: data.companyTaxNumber ? `Steuernummer: ${escapeHtml(data.companyTaxNumber)}` : '',
		company_legal: escapeHtml(data.companyLegal),
		company_email: data.companyEmail ? escapeHtml(data.companyEmail) : '',
		company_phone: data.companyPhone ? ` · ${escapeHtml(data.companyPhone)}` : '',
		customer_name: escapeHtml(data.customerName),
		customer_email: escapeHtml(data.customerEmail),
		customer_address: data.customerAddress,
		customer_vat_id_row: customerVatIdRow,
		items_rows: itemsRows,
		subtotal: formatCents(data.subtotalCents),
		vat_rate: String(data.vatRate),
		vat_amount: formatCents(data.vatCents),
		vat_row: vatRow,
		total: formatCents(data.totalCents),
		currency_symbol: sym,
		reverse_charge_row: reverseChargeRow,
		notes: data.notes || '',
	};

	return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ── Amount computation ─────────────────────────────────────────────────────────

/**
 * Net items whose sum equals the invoice's net total exactly. VAT is computed once on the
 * gross total (not per line), and the rounding remainder goes to the largest line.
 */
function buildItems(lines: { description: string; grossCents: number }[], rate: number) {
	const grossTotal = lines.reduce((s, l) => s + l.grossCents, 0);
	const { netCents, vatCents } = splitGross(grossTotal, rate);

	const items: InvoiceItem[] = lines.map((l) => {
		const net = rate > 0 ? Math.round((l.grossCents * 100) / (100 + rate)) : l.grossCents;
		return { description: l.description, quantity: 1, unitPriceCents: net, totalCents: net, grossCents: l.grossCents };
	});
	const remainder = netCents - items.reduce((s, i) => s + i.totalCents, 0);
	if (remainder !== 0 && items.length > 0) {
		const largest = items.reduce((a, b) => (Math.abs(b.totalCents) > Math.abs(a.totalCents) ? b : a));
		largest.totalCents += remainder;
		largest.unitPriceCents = largest.totalCents;
	}
	return { items, subtotalCents: netCents, vatCents, totalCents: grossTotal };
}

// ── Issuing ────────────────────────────────────────────────────────────────────

export async function findInvoiceByPaymentReference(paymentReference: string) {
	return db.query.invoices.findFirst({ where: eq(invoices.paymentReference, paymentReference) });
}

/** First invoice of a subscription / installment plan — source of customer and tax data for renewals. */
export async function findFirstInvoiceForOrder(orderReference: string) {
	return db.query.invoices.findFirst({
		where: eq(invoices.orderReference, orderReference),
		orderBy: [asc(invoices.createdAt)],
	});
}

const isUniqueViolation = (err: any) => err?.code === '23505' || err?.cause?.code === '23505';

/**
 * Issues an invoice or correction. Idempotent per payment reference: webhook redeliveries
 * return the existing document. Number allocation and insert share one transaction, so a
 * failed insert rolls the counter back and the number sequence has no gaps.
 */
export async function issueInvoice(input: IssueInvoiceInput): Promise<string> {
	const existing = await findInvoiceByPaymentReference(input.paymentReference);
	if (existing) return existing.id;

	try {
		return await db.transaction(async (tx) => {
			const [settings] = await tx
				.update(siteSettings)
				.set({ invoiceNextNumber: sql`${siteSettings.invoiceNextNumber} + 1` })
				.where(eq(siteSettings.id, 1))
				.returning();
			if (!settings) throw new Error('siteSettings row not found — cannot issue invoice');

			const issuedAt = new Date();
			// RETURNING gives the post-increment value; the issued number is one less
			const invoiceNumber = `${settings.invoicePrefix}-${issuedAt.getFullYear()}-${String(settings.invoiceNextNumber - 1).padStart(4, '0')}`;

			const { items, subtotalCents, vatCents, totalCents } = buildItems(input.lines, input.vatRate);
			const currency = input.currency ?? 'eur';
			const providerLabel = PROVIDER_LABEL[input.paymentProvider] ?? input.paymentProvider;
			const isCorrection = input.kind === 'correction';

			const renderData: InvoiceRenderData = {
				kind: input.kind,
				documentTitle: isCorrection ? 'Rechnungskorrektur' : 'Rechnung',
				invoiceNumber,
				invoiceDate: formatDate(issuedAt),
				serviceDate: formatDate(input.serviceDate ?? input.paidAt),
				referenceNote: input.corrects
					? `Diese Rechnungskorrektur bezieht sich auf die Rechnung ${input.corrects.invoiceNumber} vom ${formatDate(input.corrects.invoiceDate)}.`
					: '',
				taxNote: taxNote(input.taxTreatment),
				paymentNote: isCorrection
					? `Der Betrag wurde am ${formatDate(input.paidAt)} über ${providerLabel} erstattet.`
					: `Der Betrag wurde am ${formatDate(input.paidAt)} über ${providerLabel} bezahlt.`,
				...companyData(settings),
				customerName: input.customer.name,
				customerEmail: input.customer.email,
				customerAddress: addressHtml(input.customer.address),
				customerVatId: input.customer.vatId ?? '',
				items,
				subtotalCents,
				vatRate: input.vatRate,
				vatCents,
				totalCents,
				currency,
				taxTreatment: input.taxTreatment,
				isReverseCharge: input.taxTreatment === 'reverse_charge',
				notes: settings.invoiceFooter ?? '',
			};

			const htmlSnapshot = renderInvoiceHtml(renderData, settings.invoiceTemplate);
			const pdf = await renderInvoicePdf(renderData);

			const [invoice] = await tx
				.insert(invoices)
				.values({
					invoiceNumber,
					purchaseId: input.purchaseId ?? null,
					userId: input.userId,
					customerName: input.customer.name,
					customerEmail: input.customer.email,
					customerAddressJson: JSON.stringify(input.customer.address),
					customerVatId: input.customer.vatId || null,
					customerCountry: input.customer.address.country?.toUpperCase() || null,
					items: JSON.stringify(items),
					subtotalCents,
					vatRate: input.vatRate,
					vatCents,
					totalCents,
					currency,
					isReverseCharge: input.taxTreatment === 'reverse_charge',
					taxTreatment: input.taxTreatment,
					htmlSnapshot,
					pdfBase64: pdf.toString('base64'),
					contentHash: createHash('sha256').update(pdf).digest('hex'),
					status: 'paid',
					type: input.type,
					kind: input.kind,
					correctsInvoiceId: input.corrects?.id ?? null,
					serviceDate: input.serviceDate ?? input.paidAt,
					paymentProvider: input.paymentProvider,
					paymentReference: input.paymentReference,
					orderReference: input.orderReference ?? null,
					paidAt: input.paidAt,
					invoiceDate: issuedAt,
				})
				.returning({ id: invoices.id });

			return invoice.id;
		});
	} catch (err) {
		// A concurrent delivery of the same event issued it first
		if (isUniqueViolation(err)) {
			const winner = await findInvoiceByPaymentReference(input.paymentReference);
			if (winner) return winner.id;
		}
		throw err;
	}
}

/**
 * Issues a correction (negative amounts) for a refund. A full refund mirrors the original
 * lines; a partial refund becomes a single line. Customer and tax data are copied from the
 * original so the correction reverses exactly the VAT that was declared.
 */
export async function issueCorrection(opts: {
	original: typeof invoices.$inferSelect;
	refundedGrossCents: number;
	paymentReference: string;
	refundedAt: Date;
}): Promise<string> {
	const { original, refundedGrossCents, paymentReference, refundedAt } = opts;
	const originalItems: InvoiceItem[] = JSON.parse(original.items || '[]');

	const isFull = refundedGrossCents === original.totalCents && originalItems.every((i) => i.grossCents !== undefined);
	const lines = isFull
		? originalItems.map((i) => ({ description: `Storno: ${i.description}`, grossCents: -(i.grossCents as number) }))
		: [{ description: `Teilerstattung zu Rechnung ${original.invoiceNumber}`, grossCents: -refundedGrossCents }];

	const address: CustomerAddress = original.customerAddressJson ? JSON.parse(original.customerAddressJson) : {};

	const id = await issueInvoice({
		kind: 'correction',
		type: original.type,
		userId: original.userId,
		purchaseId: original.purchaseId,
		corrects: { id: original.id, invoiceNumber: original.invoiceNumber, invoiceDate: original.invoiceDate },
		customer: { name: original.customerName, email: original.customerEmail, address, vatId: original.customerVatId },
		taxTreatment: original.taxTreatment,
		vatRate: original.vatRate,
		lines,
		currency: original.currency,
		paymentProvider: (original.paymentProvider as 'stripe' | 'paypal') ?? 'stripe',
		paymentReference,
		orderReference: original.orderReference,
		paidAt: refundedAt,
		serviceDate: original.serviceDate ?? original.invoiceDate,
	});

	if (isFull) {
		// Status is bookkeeping metadata only — the original document stays unchanged
		await db.update(invoices).set({ status: 'refunded' }).where(eq(invoices.id, original.id));
	}
	return id;
}

/** Customer snapshot from the checkout form (sent as metadata), falling back to the provider's data. */
export function customerFromCheckout(
	metadata: Record<string, string | undefined> | null | undefined,
	fallback: { name?: string | null; email?: string | null; address?: Partial<Record<string, string | null>> | null },
): CustomerSnapshot {
	const m = metadata ?? {};
	const fa = fallback.address ?? {};
	const hasFormAddress = !!(m.billingStreet || m.billingCity);
	return {
		name: m.billingName || fallback.name || '',
		email: m.billingEmail || fallback.email || '',
		address: hasFormAddress
			? {
				line1: m.billingStreet || undefined,
				postal_code: m.billingZip || undefined,
				city: m.billingCity || undefined,
				country: (m.billingCountry || fa.country || '').toUpperCase() || undefined,
			}
			: {
				line1: fa.line1 ?? undefined,
				line2: fa.line2 ?? undefined,
				postal_code: fa.postal_code ?? undefined,
				city: fa.city ?? undefined,
				country: (m.billingCountry || fa.country || '').toUpperCase() || undefined,
			},
		vatId: m.billingVatId || null,
	};
}

// ── Delivery ───────────────────────────────────────────────────────────────────

/** Emails the invoice PDF to the customer. */
export async function sendInvoiceEmail(invoiceId: string) {
	const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, invoiceId) });
	if (!invoice?.pdfBase64) return;
	const recipient = invoice.customerEmail || (await db.query.user.findFirst({ where: eq(user.id, invoice.userId) }))?.email;
	if (!recipient) return;

	const title = invoice.kind === 'correction' ? 'Rechnungskorrektur' : 'Rechnung';
	await sendMail({
		to: recipient,
		subject: `Deine ${title} ${invoice.invoiceNumber}`,
		html: `<p>Hallo ${escapeHtml(invoice.customerName || '')},</p><p>im Anhang findest du deine ${title} <strong>${escapeHtml(invoice.invoiceNumber)}</strong>.</p><p>Du kannst sie jederzeit auch in deinem Konto unter „Abrechnung“ herunterladen.</p>`,
		attachments: [{
			filename: `${title}-${invoice.invoiceNumber}.pdf`,
			content: Buffer.from(invoice.pdfBase64, 'base64'),
			contentType: 'application/pdf',
		}],
	});
}

// ── Query helpers ──────────────────────────────────────────────────────────────

export async function getInvoice(id: string) {
	return db.query.invoices.findFirst({
		where: eq(invoices.id, id),
		with: { user: true, purchase: { with: { course: true } } },
	});
}

export async function getInvoicesForUser(userId: string) {
	return db.query.invoices.findMany({
		where: eq(invoices.userId, userId),
		orderBy: [desc(invoices.invoiceDate)],
		columns: { pdfBase64: false, htmlSnapshot: false },
		extras: { hasPdf: sql<boolean>`${invoices.pdfBase64} is not null`.as('has_pdf') },
	});
}

export async function getInvoicesForPurchase(purchaseId: string) {
	return db.query.invoices.findMany({
		where: eq(invoices.purchaseId, purchaseId),
		orderBy: [desc(invoices.invoiceDate)],
	});
}

export async function getAllInvoices(limit = 50, offset = 0) {
	const rows = await db.query.invoices.findMany({
		orderBy: [desc(invoices.invoiceDate)],
		with: { user: true },
		columns: { pdfBase64: false, htmlSnapshot: false },
		extras: { hasPdf: sql<boolean>`${invoices.pdfBase64} is not null`.as('has_pdf') },
		limit,
		offset,
	});
	return rows;
}
