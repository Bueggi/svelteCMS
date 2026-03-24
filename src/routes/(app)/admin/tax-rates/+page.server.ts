import { db } from '$lib/server/db';
import { taxRates } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const rates = await db.select().from(taxRates).orderBy(taxRates.countryCode);
    return { rates };
};

export const actions: Actions = {
    createRate: async ({ request }) => {
        const data = await request.formData();
        const countryCode = data.get('countryCode')?.toString()?.trim().toUpperCase();
        const countryName = data.get('countryName')?.toString()?.trim();
        const rateRaw = data.get('rate')?.toString();

        if (!countryCode || countryCode.length !== 2) return fail(400, { message: 'Ungültiger Ländercode (2 Buchstaben)' });
        if (!countryName) return fail(400, { message: 'Ländername fehlt' });

        const rate = parseInt(rateRaw ?? '');
        if (isNaN(rate) || rate < 0 || rate > 100) return fail(400, { message: 'Rate muss zwischen 0 und 100 liegen' });

        try {
            await db.insert(taxRates).values({ countryCode, countryName, rate, isEnabled: true });
            return { success: true };
        } catch (e: any) {
            if (e.code === '23505') return fail(400, { message: `Eintrag für ${countryCode} existiert bereits` });
            return fail(500, { message: 'Fehler beim Speichern' });
        }
    },

    updateRate: async ({ request }) => {
        const data = await request.formData();
        const id = data.get('id')?.toString();
        const rateRaw = data.get('rate')?.toString();

        if (!id) return fail(400, { message: 'ID fehlt' });
        const rate = parseInt(rateRaw ?? '');
        if (isNaN(rate) || rate < 0 || rate > 100) return fail(400, { message: 'Rate muss zwischen 0 und 100 liegen' });

        await db.update(taxRates).set({ rate }).where(eq(taxRates.id, id));
        return { success: true };
    },

    toggleRate: async ({ request }) => {
        const data = await request.formData();
        const id = data.get('id')?.toString();
        if (!id) return fail(400, { message: 'ID fehlt' });

        const row = await db.query.taxRates.findFirst({ where: eq(taxRates.id, id) });
        if (!row) return fail(404, { message: 'Eintrag nicht gefunden' });

        await db.update(taxRates).set({ isEnabled: !row.isEnabled }).where(eq(taxRates.id, id));
        return { success: true };
    },

    deleteRate: async ({ request }) => {
        const data = await request.formData();
        const id = data.get('id')?.toString();
        if (!id) return fail(400, { message: 'ID fehlt' });

        await db.delete(taxRates).where(eq(taxRates.id, id));
        return { success: true };
    },
};
