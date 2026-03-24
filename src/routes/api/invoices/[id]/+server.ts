import { error, text } from '@sveltejs/kit';
import { getInvoice } from '$lib/server/invoices';
import type { RequestHandler } from './$types';

/**
 * GET /api/invoices/[id]
 * Returns the rendered HTML invoice.
 * ?print=1  → injects window.print() so the browser opens the print dialog immediately
 *
 * Access control: the invoice owner OR any admin/instructor may view it.
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) throw error(401, 'Nicht eingeloggt');

	const invoice = await getInvoice(params.id);
	if (!invoice) throw error(404, 'Rechnung nicht gefunden');

	const isOwner = invoice.userId === locals.user.id;
	const isAdmin =
		locals.user.role === 'admin' || locals.user.role === 'instructor';

	if (!isOwner && !isAdmin) throw error(403, 'Kein Zugriff');

	const autoPrint = url.searchParams.get('print') === '1';
	const html = invoice.htmlSnapshot ?? '<p>Keine Rechnungsdaten vorhanden.</p>';

	// Inject auto-print script if requested
	const printScript = autoPrint
		? `<script>window.addEventListener('load', () => { window.print(); });</script>`
		: '';

	const fullHtml = html.replace('</body>', `${printScript}</body>`);

	return text(fullHtml, {
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			// Instruct browser to treat as inline document (not download)
			'Content-Disposition': `inline; filename="Rechnung-${invoice.invoiceNumber}.html"`,
		},
	});
};
