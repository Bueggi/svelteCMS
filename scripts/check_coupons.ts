import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/lib/server/db/schema';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function main() {
    const coupons = await db.query.coupons.findMany();
    console.log(`Found ${coupons.length} coupons:`);
    console.log(JSON.stringify(coupons, null, 2));
    process.exit(0);
}

main().catch(console.error);
