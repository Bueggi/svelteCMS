import { redirect } from '@sveltejs/kit';
import { getAllInvoices } from '$lib/server/invoices';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(302, '/login');
	if (locals.user.role !== 'admin' && locals.user.role !== 'instructor') {
		throw redirect(302, '/dashboard');
	}

	const page = parseInt(url.searchParams.get('page') ?? '1');
	const limit = 50;
	const offset = (page - 1) * limit;

	const invoiceList = await getAllInvoices(limit, offset);

	return { invoiceList, page };
};
