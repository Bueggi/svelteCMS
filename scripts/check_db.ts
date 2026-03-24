import postgres from 'postgres';
const DB = process.env.DATABASE_URL;
if (!DB) throw new Error('No DATABASE_URL');
const sql = postgres(DB);
async function run() {
    const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'upsells' ORDER BY ordinal_position`;
    console.log(res.map((r: any) => r.column_name).join(', ') || 'Table not found');
    await sql.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
