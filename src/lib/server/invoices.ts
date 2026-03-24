/**
 * Invoice service
 * - Generates sequential invoice numbers (atomic DB counter)
 * - Creates invoice records from Stripe checkout sessions
 * - Renders HTML snapshots from the admin-configurable template
 * - Provides query helpers for admin and customer views
 */
import { db } from './db';
import { invoices, siteSettings, purchases } from './db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { DEFAULT_INVOICE_TEMPLATE } from './invoiceTemplate';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InvoiceItem {
	description: string;
	quantity: number;
	unitPriceCents: number;
	totalCents: number;
}

export interface InvoiceRenderData {
	invoiceNumber: string;
	invoiceDate: string;
	// Company
	companyName: string;
	companyAddress: string;
	companyVatId: string;
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
	isReverseCharge: boolean;
	// Footer
	notes: string;
}

// ── Invoice number generation (atomic) ────────────────────────────────────────

export async function generateInvoiceNumber(): Promise<string> {
	const [row] = await db
		.update(siteSettings)
		.set({ invoiceNextNumber: sql`${siteSettings.invoiceNextNumber} + 1` })
		.where(eq(siteSettings.id, 1))
		.returning({
			num: siteSettings.invoiceNextNumber,
			prefix: siteSettings.invoicePrefix,
		});

	if (!row) throw new Error('siteSettings row not found — cannot generate invoice number');

	// RETURNING gives the new (post-increment) value; the issued number is one less
	const issuedNum = row.num - 1;
	const year = new Date().getFullYear();
	return `${row.prefix}-${year}-${String(issuedNum).padStart(4, '0')}`;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

function formatCents(cents: number, currency = 'eur'): string {
	return (cents / 100).toLocaleString('de-DE', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function currencySymbol(currency: string): string {
	return currency.toLowerCase() === 'eur' ? '€' : currency.toUpperCase();
}

function formatDate(date: Date): string {
	return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── HTML rendering ─────────────────────────────────────────────────────────────

export function renderInvoiceHtml(data: InvoiceRenderData, template?: string | null): string {
	const tpl = template || DEFAULT_INVOICE_TEMPLATE;
	const sym = currencySymbol(data.currency);

	// Build items rows
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

	// VAT row
	const vatRow = data.isReverseCharge
		? `<div class="totals-row"><span>MwSt. (0 % — Reverse Charge)</span><span>${sym}0,00</span></div>`
		: `<div class="totals-row"><span>MwSt. (${data.vatRate} %)</span><span>${sym}${formatCents(data.vatCents)}</span></div>`;

	// Reverse charge note
	const reverseChargeRow = data.isReverseCharge
		? `<div class="totals-row reverse-charge"><span>Steuerschuldnerschaft des Leistungsempfängers (§13b UStG)</span></div>`
		: '';

	// Customer VAT ID row
	const customerVatIdRow = data.customerVatId
		? `<br>USt-IdNr.: ${escapeHtml(data.customerVatId)}`
		: '';

	const vars: Record<string, string> = {
		invoice_number: escapeHtml(data.invoiceNumber),
		invoice_date: escapeHtml(data.invoiceDate),
		company_name: escapeHtml(data.companyName),
		company_address: data.companyAddress,
		company_vat_id: data.companyVatId ? `USt-IdNr.: ${escapeHtml(data.companyVatId)}` : '',
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

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// ── Create invoice from Stripe checkout session ────────────────────────────────

export async function createInvoiceFromCheckout(opts: {
	purchaseId: string;
	userId: string;
	session: any; // Stripe CheckoutSession
	courseTitle: string;
	stripeInvoiceId?: string;
	stripePdfUrl?: string;
}): Promise<string> {
	const { purchaseId, userId, session, courseTitle, stripeInvoiceId, stripePdfUrl } = opts;

	const settings = await db.query.siteSettings.findFirst();
	if (!settings) throw new Error('siteSettings not found');

	const invoiceNumber = await generateInvoiceNumber();

	const customerDetails = session.customer_details ?? {};
	const billingAddress = customerDetails.address ?? {};

	const addressLines = [
		billingAddress.line1,
		billingAddress.line2,
		[billingAddress.postal_code, billingAddress.city].filter(Boolean).join(' '),
		billingAddress.country,
	]
		.filter(Boolean)
		.join('<br>');

	const isReverseCharge = session.metadata?.reverseCharge === 'true';
	const currency = session.currency ?? 'eur';
	const totalCents = session.amount_total ?? 0;

	// Calculate VAT
	const vatRate = isReverseCharge ? 0 : (settings.vatRate ?? 0);
	const vatCents = isReverseCharge ? 0 : Math.round(totalCents - totalCents / (1 + vatRate / 100));
	const subtotalCents = totalCents - vatCents;

	const items: InvoiceItem[] = [
		{
			description: courseTitle,
			quantity: 1,
			unitPriceCents: subtotalCents,
			totalCents: subtotalCents,
		},
	];

	// Company address block
	const companyAddress = [
		settings.companyStreet,
		[settings.companyZip, settings.companyCity].filter(Boolean).join(' '),
		settings.companyCountry,
	]
		.filter(Boolean)
		.join('<br>');

	const renderData: InvoiceRenderData = {
		invoiceNumber,
		invoiceDate: formatDate(new Date()),
		companyName: settings.companyName ?? settings.appName,
		companyAddress,
		companyVatId: settings.companyVatId ?? '',
		companyEmail: settings.companyEmail ?? '',
		companyPhone: settings.companyPhone ?? '',
		customerName: customerDetails.name ?? '',
		customerEmail: customerDetails.email ?? '',
		customerAddress: addressLines,
		customerVatId: session.metadata?.vatId ?? '',
		items,
		subtotalCents,
		vatRate,
		vatCents,
		totalCents,
		currency,
		isReverseCharge,
		notes: settings.invoiceFooter ?? '',
	};

	const htmlSnapshot = renderInvoiceHtml(renderData, settings.invoiceTemplate);

	const [invoice] = await db
		.insert(invoices)
		.values({
			invoiceNumber,
			purchaseId,
			userId,
			customerName: renderData.customerName,
			customerEmail: renderData.customerEmail,
			customerAddressJson: JSON.stringify(billingAddress),
			customerVatId: renderData.customerVatId || null,
			items: JSON.stringify(items),
			subtotalCents,
			vatRate,
			vatCents,
			totalCents,
			currency,
			isReverseCharge,
			stripeInvoiceId: stripeInvoiceId ?? null,
			stripePdfUrl: stripePdfUrl ?? null,
			htmlSnapshot,
			status: 'issued',
			type: 'one_time',
		})
		.returning({ id: invoices.id });

	return invoice.id;
}

// ── Create invoice from Stripe subscription payment ───────────────────────────

export async function createInvoiceFromSubscriptionPayment(opts: {
	userId: string;
	stripeInvoice: any; // Stripe.Invoice
	courseTitle: string;
}): Promise<string> {
	const { userId, stripeInvoice, courseTitle } = opts;

	const settings = await db.query.siteSettings.findFirst();
	if (!settings) throw new Error('siteSettings not found');

	const invoiceNumber = await generateInvoiceNumber();

	const totalCents = stripeInvoice.amount_paid ?? 0;
	const currency = stripeInvoice.currency ?? 'eur';
	const isReverseCharge = false;
	const vatRate = settings.vatRate ?? 0;
	const vatCents = Math.round(totalCents - totalCents / (1 + vatRate / 100));
	const subtotalCents = totalCents - vatCents;

	const items: InvoiceItem[] = [
		{
			description: `${courseTitle} — Abo-Zahlung`,
			quantity: 1,
			unitPriceCents: subtotalCents,
			totalCents: subtotalCents,
		},
	];

	const customerEmail = stripeInvoice.customer_email ?? '';
	const companyAddress = [
		settings.companyStreet,
		[settings.companyZip, settings.companyCity].filter(Boolean).join(' '),
		settings.companyCountry,
	]
		.filter(Boolean)
		.join('<br>');

	const renderData: InvoiceRenderData = {
		invoiceNumber,
		invoiceDate: formatDate(new Date()),
		companyName: settings.companyName ?? settings.appName,
		companyAddress,
		companyVatId: settings.companyVatId ?? '',
		companyEmail: settings.companyEmail ?? '',
		companyPhone: settings.companyPhone ?? '',
		customerName: stripeInvoice.customer_name ?? '',
		customerEmail,
		customerAddress: '',
		customerVatId: '',
		items,
		subtotalCents,
		vatRate,
		vatCents,
		totalCents,
		currency,
		isReverseCharge,
		notes: settings.invoiceFooter ?? '',
	};

	const htmlSnapshot = renderInvoiceHtml(renderData, settings.invoiceTemplate);

	const [invoice] = await db
		.insert(invoices)
		.values({
			invoiceNumber,
			userId,
			customerName: renderData.customerName,
			customerEmail,
			items: JSON.stringify(items),
			subtotalCents,
			vatRate,
			vatCents,
			totalCents,
			currency,
			isReverseCharge,
			stripeInvoiceId: stripeInvoice.id ?? null,
			stripePdfUrl: stripeInvoice.invoice_pdf ?? null,
			htmlSnapshot,
			status: 'issued',
			type: 'subscription',
		})
		.returning({ id: invoices.id });

	return invoice.id;
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
	});
}

export async function getInvoicesForPurchase(purchaseId: string) {
	return db.query.invoices.findMany({
		where: eq(invoices.purchaseId, purchaseId),
		orderBy: [desc(invoices.invoiceDate)],
	});
}

export async function getAllInvoices(limit = 50, offset = 0) {
	return db.query.invoices.findMany({
		orderBy: [desc(invoices.invoiceDate)],
		with: { user: true },
		limit,
		offset,
	});
}

/** Marks invoice as refunded (call when a purchase is refunded). */
export async function voidInvoicesForPurchase(purchaseId: string) {
	await db
		.update(invoices)
		.set({ status: 'refunded' })
		.where(eq(invoices.purchaseId, purchaseId));
}

/** Re-renders ALL invoice snapshots with the current template. */
export async function regenerateAllInvoiceSnapshots(): Promise<{ updated: number; errors: number }> {
	const all = await db.query.invoices.findMany();
	let updated = 0;
	let errors = 0;
	for (const inv of all) {
		try {
			await regenerateInvoiceSnapshot(inv.id);
			updated++;
		} catch {
			errors++;
		}
	}
	return { updated, errors };
}

/** Re-renders the HTML snapshot from the current template (after admin edits template). */
export async function regenerateInvoiceSnapshot(invoiceId: string) {
	const invoice = await getInvoice(invoiceId);
	if (!invoice) return;
	const settings = await db.query.siteSettings.findFirst();
	if (!settings) return;

	const items: InvoiceItem[] = JSON.parse(invoice.items || '[]');
	const addr: any = invoice.customerAddressJson
		? JSON.parse(invoice.customerAddressJson)
		: {};

	const addressLines = [
		addr.line1,
		addr.line2,
		[addr.postal_code, addr.city].filter(Boolean).join(' '),
		addr.country,
	]
		.filter(Boolean)
		.join('<br>');

	const companyAddress = [
		settings.companyStreet,
		[settings.companyZip, settings.companyCity].filter(Boolean).join(' '),
		settings.companyCountry,
	]
		.filter(Boolean)
		.join('<br>');

	const renderData: InvoiceRenderData = {
		invoiceNumber: invoice.invoiceNumber,
		invoiceDate: formatDate(invoice.invoiceDate),
		companyName: settings.companyName ?? settings.appName,
		companyAddress,
		companyVatId: settings.companyVatId ?? '',
		companyEmail: settings.companyEmail ?? '',
		companyPhone: settings.companyPhone ?? '',
		customerName: invoice.customerName,
		customerEmail: invoice.customerEmail,
		customerAddress: addressLines,
		customerVatId: invoice.customerVatId ?? '',
		items,
		subtotalCents: invoice.subtotalCents,
		vatRate: invoice.vatRate,
		vatCents: invoice.vatCents,
		totalCents: invoice.totalCents,
		currency: invoice.currency,
		isReverseCharge: invoice.isReverseCharge,
		notes: settings.invoiceFooter ?? '',
	};

	const htmlSnapshot = renderInvoiceHtml(renderData, settings.invoiceTemplate);
	await db.update(invoices).set({ htmlSnapshot }).where(eq(invoices.id, invoiceId));
}
