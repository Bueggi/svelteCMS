import PDFDocument from 'pdfkit';
import type { InvoiceRenderData } from './invoices';

/**
 * Renders the archive/customer PDF of an invoice (A4, fixed legal layout).
 * Rendered once at issue time from the same data as the HTML view; the bytes are
 * stored with a SHA-256 hash and never regenerated (GoBD: unveränderbar).
 */

const MARGIN = 56;
const PAGE_WIDTH = 595.28; // A4 in pt
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const eur = (cents: number) =>
	(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const stripHtml = (s: string) => s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();

export function renderInvoicePdf(data: InvoiceRenderData): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			size: 'A4',
			bufferPages: true, // footer is written onto every page at the end
			margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
			info: { Title: `${data.documentTitle} ${data.invoiceNumber}`, Author: data.companyName },
		});
		const chunks: Buffer[] = [];
		doc.on('data', (c: Buffer) => chunks.push(c));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		const companyAddress = stripHtml(data.companyAddress);
		const customerAddress = stripHtml(data.customerAddress);

		// ── Header: seller ──
		doc.font('Helvetica-Bold').fontSize(16).text(data.companyName, MARGIN, MARGIN);
		doc.font('Helvetica').fontSize(9).fillColor('#444')
			.text([companyAddress.replace(/\n/g, ' · '), data.companyEmail].filter(Boolean).join(' · '));
		doc.fillColor('#000');

		// ── Recipient (left) + meta (right) ──
		const blockTop = 140;
		doc.fontSize(7).fillColor('#666')
			.text(`${data.companyName} · ${companyAddress.replace(/\n/g, ' · ')}`, MARGIN, blockTop, { width: 260 });
		doc.fillColor('#000').fontSize(10).font('Helvetica')
			.text([data.customerName, customerAddress, data.customerVatId ? `USt-IdNr.: ${data.customerVatId}` : '']
				.filter(Boolean).join('\n'), MARGIN, blockTop + 14, { width: 260 });

		const metaX = MARGIN + 300;
		const meta: [string, string][] = [
			[data.kind === 'correction' ? 'Korrektur-Nr.' : 'Rechnungs-Nr.', data.invoiceNumber],
			['Rechnungsdatum', data.invoiceDate],
			['Leistungsdatum', data.serviceDate],
		];
		if (data.customerEmail) meta.push(['Kunde', data.customerEmail]);
		let y = blockTop;
		for (const [label, value] of meta) {
			doc.font('Helvetica').fontSize(9).fillColor('#666').text(label, metaX, y, { width: 90 });
			doc.fillColor('#000').text(value, metaX + 90, y, { width: CONTENT_WIDTH - 390 });
			y += 14;
		}

		// ── Title ──
		doc.font('Helvetica-Bold').fontSize(18).text(data.documentTitle, MARGIN, 250);
		if (data.referenceNote) {
			doc.font('Helvetica').fontSize(10).text(data.referenceNote, MARGIN, doc.y + 4);
		}

		// ── Items table ──
		const cols = { pos: MARGIN, desc: MARGIN + 30, qty: MARGIN + 300, unit: MARGIN + 350, total: MARGIN + 420 };
		let rowY = doc.y + 16;
		const header = () => {
			doc.font('Helvetica-Bold').fontSize(9);
			doc.text('Pos.', cols.pos, rowY);
			doc.text('Leistung', cols.desc, rowY);
			doc.text('Menge', cols.qty, rowY, { width: 40, align: 'right' });
			doc.text('Einzelpreis', cols.unit, rowY, { width: 65, align: 'right' });
			doc.text('Netto', cols.total, rowY, { width: CONTENT_WIDTH - 420, align: 'right' });
			rowY += 14;
			doc.moveTo(MARGIN, rowY).lineTo(MARGIN + CONTENT_WIDTH, rowY).strokeColor('#999').lineWidth(0.5).stroke();
			rowY += 6;
		};
		header();
		doc.font('Helvetica').fontSize(9);
		data.items.forEach((item, i) => {
			const descHeight = doc.heightOfString(item.description, { width: 260 });
			if (rowY + descHeight > 760) {
				doc.addPage();
				rowY = MARGIN;
				header();
				doc.font('Helvetica').fontSize(9);
			}
			doc.text(String(i + 1), cols.pos, rowY);
			doc.text(item.description, cols.desc, rowY, { width: 260 });
			doc.text(String(item.quantity), cols.qty, rowY, { width: 40, align: 'right' });
			doc.text(eur(item.unitPriceCents), cols.unit, rowY, { width: 65, align: 'right' });
			doc.text(eur(item.totalCents), cols.total, rowY, { width: CONTENT_WIDTH - 420, align: 'right' });
			rowY += Math.max(descHeight, 12) + 6;
		});
		doc.moveTo(MARGIN, rowY).lineTo(MARGIN + CONTENT_WIDTH, rowY).strokeColor('#999').lineWidth(0.5).stroke();
		rowY += 8;

		// ── Totals ──
		const totalsX = MARGIN + 260;
		const totalsRow = (label: string, value: string, bold = false) => {
			doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9);
			doc.text(label, totalsX, rowY, { width: 150 });
			doc.text(value, totalsX + 150, rowY, { width: CONTENT_WIDTH - 410, align: 'right' });
			rowY += bold ? 18 : 14;
		};
		totalsRow('Summe netto', eur(data.subtotalCents));
		totalsRow(`Umsatzsteuer ${data.vatRate} %`, eur(data.vatCents));
		totalsRow('Gesamtbetrag', eur(data.totalCents), true);

		// ── Notes ──
		doc.font('Helvetica').fontSize(9).fillColor('#000');
		const notes = [data.taxNote, data.paymentNote].filter(Boolean).join('\n');
		if (notes) doc.text(notes, MARGIN, rowY + 12, { width: CONTENT_WIDTH });
		if (data.notes) doc.fillColor('#444').text(stripHtml(data.notes), MARGIN, doc.y + 8, { width: CONTENT_WIDTH });

		// ── Footer: legal seller information ──
		const footer = [
			[data.companyName, companyAddress.replace(/\n/g, ', ')].filter(Boolean).join(' · '),
			[data.companyEmail, data.companyPhone].filter(Boolean).join(' · '),
			[data.companyVatId ? `USt-IdNr.: ${data.companyVatId}` : '', data.companyTaxNumber ? `Steuernummer: ${data.companyTaxNumber}` : '']
				.filter(Boolean).join(' · '),
			data.companyLegal,
		].filter(Boolean).join('\n');
		const range = doc.bufferedPageRange();
		for (let p = range.start; p < range.start + range.count; p++) {
			doc.switchToPage(p);
			doc.page.margins.bottom = 0; // footer sits inside the bottom margin; don't trigger a page break
			doc.font('Helvetica').fontSize(7.5).fillColor('#666')
				.text(footer, MARGIN, 785, { width: CONTENT_WIDTH, align: 'center', lineBreak: true, height: 40 });
		}

		doc.end();
	});
}
