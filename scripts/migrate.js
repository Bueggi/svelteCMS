/**
 * Startup migration script — runs before the app starts (see Dockerfile CMD).
 * Uses drizzle-orm's programmatic migrator (no drizzle-kit needed in production).
 * Only applies NEW migrations — never drops tables or columns.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '../drizzle');

// Same lookup order as the app: environment variable, then the file the setup wizard writes.
function resolveDatabaseUrl() {
	if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
	try {
		const file = resolve(process.env.CONFIG_FILE || 'data/config.json');
		return JSON.parse(readFileSync(file, 'utf8')).databaseUrl;
	} catch {
		return undefined;
	}
}

const DATABASE_URL = resolveDatabaseUrl();
if (!DATABASE_URL) {
	// Fresh install without a database yet: the /setup wizard collects the connection string
	// and creates the schema itself, so there is nothing to do here.
	console.log('ℹ️  No database configured yet — skipping migrations (the /setup wizard handles it).');
	process.exit(0);
}

const client = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

// A database created with `drizzle-kit push` has tables but no migration history.
// Running the baseline on it would fail with "already exists", so leave it alone.
const [{ has_tables, has_history }] = await client`
	SELECT to_regclass('public."user"') IS NOT NULL AS has_tables,
	       to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_history`;
if (has_tables && !has_history) {
	console.warn('⚠️  Existing database without migration history (created via db:push) — skipping migrations.');
	await client.end();
	process.exit(0);
}

console.log('🔄  Running database migrations…');
await migrate(drizzle(client), { migrationsFolder });
await client.end();
console.log('✅  Migrations complete.');
