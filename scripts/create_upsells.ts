import postgres from 'postgres';
const DB = process.env.DATABASE_URL;
if (!DB) throw new Error('No DATABASE_URL');
const sql = postgres(DB);
async function run() {
    await sql`
        CREATE TABLE IF NOT EXISTS upsells (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            source_course_id uuid NOT NULL REFERENCES courses(id) ON DELETE cascade,
            upsell_course_id uuid NOT NULL REFERENCES courses(id) ON DELETE cascade,
            label text,
            discount_percent integer DEFAULT 0 NOT NULL,
            is_active boolean DEFAULT true NOT NULL,
            "order" integer DEFAULT 0 NOT NULL,
            created_at timestamp DEFAULT now() NOT NULL
        )
    `;
    console.log('Table created (or already exists)!');
    await sql.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
