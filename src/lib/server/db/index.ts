import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { getDatabaseUrl } from '../config';

export type Database = PostgresJsDatabase<typeof schema>;

export class DatabaseNotConfiguredError extends Error {
    constructor() {
        super('No database configured — set DATABASE_URL or complete the /setup wizard.');
        this.name = 'DatabaseNotConfiguredError';
    }
}

// The connection is created lazily so the app can boot without a database and let the
// /setup wizard collect the connection string. Kept on globalThis to survive HMR in dev
// (singleton pattern prevents multiple connections).
const globalForDb = globalThis as unknown as {
    dbState: { url: string; client: postgres.Sql; db: Database } | undefined;
};

export function getDb(): Database {
    const url = getDatabaseUrl();
    if (!url) throw new DatabaseNotConfiguredError();

    if (globalForDb.dbState?.url !== url) {
        // URL changed (e.g. reconfigured in the wizard) — drop the old pool
        void globalForDb.dbState?.client.end({ timeout: 5 }).catch(() => {});
        const client = postgres(url);
        globalForDb.dbState = { url, client, db: drizzle(client, { schema }) };
    }
    return globalForDb.dbState.db;
}

// Drop-in replacement for the former eager `db` export: every property access resolves
// the real client, so all existing `import { db }` call sites keep working.
export const db: Database = new Proxy({} as Database, {
    get(_target, prop) {
        const real = getDb();
        const value = Reflect.get(real, prop);
        return typeof value === 'function' ? value.bind(real) : value;
    },
});
