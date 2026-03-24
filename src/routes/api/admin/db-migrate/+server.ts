import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import path from 'path';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || (locals.user as any).role !== 'admin') {
		throw error(403, 'Forbidden');
	}

	const body = (await request.json()) as { action: string; targetUrl: string };
	const { action, targetUrl } = body;

	if (!targetUrl?.trim()) {
		return json({ ok: false, error: 'Kein Connection String angegeben.' });
	}

	// ── Test connection ──────────────────────────────────────────────
	if (action === 'test') {
		let client: postgres.Sql | null = null;
		try {
			client = postgres(targetUrl, { max: 1, connect_timeout: 10, idle_timeout: 5 });
			await client`SELECT 1`;
			return json({ ok: true });
		} catch (e: any) {
			return json({ ok: false, error: e?.message ?? 'Verbindungsfehler' });
		} finally {
			await client?.end({ timeout: 5 }).catch(() => {});
		}
	}

	// ── Full migration with SSE progress stream ──────────────────────
	if (action === 'migrate') {
		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			async start(controller) {
				const send = (data: object) =>
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

				let targetClient: postgres.Sql | null = null;
				try {
					// 1. Connect to target
					send({ step: 'connect', message: 'Verbinde mit Zieldatenbank…' });
					targetClient = postgres(targetUrl, { max: 3, connect_timeout: 10 });
					await targetClient`SELECT 1`;
					send({ step: 'connect', ok: true, message: 'Verbindung erfolgreich.' });

					// 2. Run schema migrations on target
					send({ step: 'schema', message: 'Wende Schema-Migrationen an…' });
					const targetDb = drizzle(targetClient);
					const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
					await migrate(targetDb, { migrationsFolder });
					send({ step: 'schema', ok: true, message: 'Schema bereit.' });

					// 3. Get all user tables from source
					const tablesRes = await db.execute(sql`
						SELECT tablename
						FROM pg_tables
						WHERE schemaname = 'public'
						  AND tablename NOT IN ('__drizzle_migrations', 'drizzle_migrations')
						ORDER BY tablename
					`);
					const rows = Array.isArray(tablesRes)
						? tablesRes
						: (tablesRes as any).rows ?? [];
					const tables: string[] = rows.map((r: any) => r.tablename as string);
					send({ step: 'tables', message: `${tables.length} Tabellen gefunden.` });

					// 4. Disable FK / trigger checks on target for bulk copy
					await targetClient`SET session_replication_role = replica`;

					// 5. Copy table by table
					let done = 0;
					for (const table of tables) {
						send({ step: 'copy', table, done, total: tables.length, message: `Kopiere "${table}"…` });

						const srcRes = await db.execute(sql.raw(`SELECT * FROM "${table}"`));
						const srcRows: Record<string, unknown>[] = Array.isArray(srcRes)
							? (srcRes as any)
							: (srcRes as any).rows ?? [];

						// Truncate target table first
						await targetClient.unsafe(`TRUNCATE TABLE "${table}" CASCADE`);

						if (srcRows.length > 0) {
							const cols = Object.keys(srcRows[0]);
							const colsSql = cols.map((c) => `"${c}"`).join(', ');
							const BATCH = 200;

							for (let i = 0; i < srcRows.length; i += BATCH) {
								const batch = srcRows.slice(i, i + BATCH);
								const placeholders = batch
									.map(
										(_, ri) =>
											`(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`
									)
									.join(', ');
								const values = batch.flatMap((row) => cols.map((c) => row[c]));
								await targetClient.unsafe(
									`INSERT INTO "${table}" (${colsSql}) VALUES ${placeholders}`,
									values as any[]
								);
							}
						}

						done++;
						send({
							step: 'copy',
							table,
							done,
							total: tables.length,
							ok: true,
							message: `"${table}": ${srcRows.length} Zeilen kopiert.`,
						});
					}

					// 6. Re-enable FK checks
					await targetClient`SET session_replication_role = DEFAULT`;

					// 7. Reset sequences so new INSERTs won't collide
					send({ step: 'sequences', message: 'Setze Sequenzen zurück…' });
					const seqRows = await targetClient`
						SELECT
							t.relname  AS table_name,
							a.attname  AS column_name,
							s.relname  AS sequence_name
						FROM pg_class s
						JOIN pg_depend d
							ON  d.objid      = s.oid
							AND d.classid    = 'pg_class'::regclass
							AND d.refclassid = 'pg_class'::regclass
						JOIN pg_class     t ON t.oid       = d.refobjid
						JOIN pg_attribute a ON a.attrelid  = t.oid AND a.attnum = d.refobjsubid
						JOIN pg_namespace n ON n.oid       = s.relnamespace
						WHERE s.relkind = 'S' AND n.nspname = 'public'
					`;
					for (const { table_name, column_name, sequence_name } of seqRows) {
						await targetClient
							.unsafe(
								`SELECT setval('public.${sequence_name}', COALESCE((SELECT MAX("${column_name}") FROM "${table_name}"), 1))`
							)
							.catch(() => {});
					}
					send({ step: 'sequences', ok: true, message: 'Sequenzen zurückgesetzt.' });

					send({
						step: 'done',
						message:
							'Portierung abgeschlossen! Aktualisiere DATABASE_URL in deiner .env-Datei und starte die App neu.',
					});
				} catch (e: any) {
					send({ step: 'error', message: e?.message ?? 'Unbekannter Fehler' });
				} finally {
					await targetClient?.end({ timeout: 5 }).catch(() => {});
					controller.close();
				}
			},
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			},
		});
	}

	return json({ ok: false, error: 'Unbekannte Aktion.' });
};
