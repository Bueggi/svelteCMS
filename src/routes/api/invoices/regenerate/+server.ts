import { json, error } from '@sveltejs/kit';
import { regenerateAllInvoiceSnapshots } from '$lib/server/invoices';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
    if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'instructor')) {
        return error(403, 'Forbidden');
    }
    const result = await regenerateAllInvoiceSnapshots();
    return json(result);
};
