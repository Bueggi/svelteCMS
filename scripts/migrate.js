/**
 * Startup migration script — runs before the app starts.
 * Uses drizzle-orm's programmatic migrator (no drizzle-kit needed in production).
 * Only applies NEW migrations — never drops tables or columns.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '../drizzle');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('❌  DATABASE_URL is not set — skipping migrations.');
	process.exit(1);
}

console.log('🔄  Running database migrations…');
const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder });
await client.end();
console.log('✅  Migrations complete.');
