import { redirect } from '@sveltejs/kit';
import { getSettings } from '$lib/server/settings';
import { buildJournal, monthRange } from '$lib/server/accounting/journal';
import { resolveAccounts } from '$lib/accounting/accounts';
import { missingDatevSettings } from '$lib/server/accounting/export';
import type { PageServerLoad } from './$types';

function previousMonth(): string {
	const now = new Date();
	const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user?.role !== 'admin') throw redirect(302, '/admin');

	const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('month') ?? '') ? url.searchParams.get('month')! : previousMonth();
	const settings = await getSettings();
	const missing = missingDatevSettings(settings, resolveAccounts(settings?.datevChartOfAccounts, settings?.datevAccounts));

	let journal: Awaited<ReturnType<typeof buildJournal>> | null = null;
	let loadError: string | null = null;
	try {
		const { from, to } = monthRange(month);
		journal = await buildJournal(from, to);
	} catch (err: any) {
		loadError = err?.message ?? String(err);
	}

	return {
		month,
		missing,
		loadError,
		totals: journal?.totals ?? null,
		issues: journal?.issues ?? [],
		bookingCount: journal?.bookings.length ?? 0,
		documentCount: journal?.documents.length ?? 0,
		movements: (journal?.movements ?? []).map((m) => ({ ...m, date: m.date.toISOString() })),
	};
};
