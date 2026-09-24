import { error } from '@sveltejs/kit';
import { getSettings } from '$lib/server/settings';
import { resolveAccounts } from '$lib/accounting/accounts';
import { buildMonthlyExport, missingDatevSettings } from '$lib/server/accounting/export';
import type { RequestHandler } from './$types';

/**
 * GET /admin/accounting/export?month=YYYY-MM[&force=1]
 * ZIP with DATEV Buchungsstapel, invoice PDFs, Rechnungsausgangsbuch and reconciliation.
 * Refuses when the reconciliation has errors unless the admin explicitly forces it.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	// +server.ts routes don't run the admin layout's guard
	if (locals.user?.role !== 'admin') throw error(403, 'Nur für Administratoren');

	const month = url.searchParams.get('month') ?? '';
	if (!/^\d{4}-\d{2}$/.test(month)) throw error(400, 'Parameter month=YYYY-MM fehlt');

	const settings = await getSettings();
	const missing = missingDatevSettings(settings, resolveAccounts(settings?.datevChartOfAccounts, settings?.datevAccounts));
	if (missing.length > 0) throw error(400, `Bitte zuerst in den Einstellungen ergänzen: ${missing.join(', ')}`);

	const { zip, filename, journal } = await buildMonthlyExport(month);
	const errors = journal.issues.filter((i) => i.severity === 'error');
	if (errors.length > 0 && url.searchParams.get('force') !== '1') {
		throw error(409, `Der Abgleich hat ${errors.length} Fehler — bitte prüfen oder bewusst trotzdem exportieren.`);
	}

	return new Response(Buffer.from(zip), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${filename}"`,
		},
	});
};
