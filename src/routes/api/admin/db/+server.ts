import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
    if (locals.user?.role !== 'admin') throw error(403);

    const result = await db.execute(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    `);

    // postgres-js returns array-like result
    const tables = Array.from(result as any).map((r: any) => r.table_name);
    return json({ tables });
};

export const POST: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== 'admin') throw error(403);

    const { query, table, limit = 50, offset = 0 } = await request.json();

    try {
        let sqlStr: string;

        if (query) {
            sqlStr = query.trim();
        } else if (table) {
            sqlStr = `SELECT * FROM "${table}" LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
        } else {
            throw error(400, 'query or table required');
        }

        const result = await db.execute(sql.raw(sqlStr)) as any;
        const rows = Array.from(result);
        const fields = (result as any).columns ?? (rows[0] ? Object.keys(rows[0]) : []);

        return json({
            rows,
            fields,
            rowCount: (result as any).count ?? rows.length,
        });
    } catch (e: any) {
        if (e.status) throw e;
        return json({ error: e.message }, { status: 400 });
    }
};
