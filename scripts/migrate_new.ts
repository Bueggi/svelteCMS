import postgres from 'postgres';
const DB = process.env.DATABASE_URL as string;
const sql = postgres(DB);
async function run() {
    await sql`
        CREATE TABLE IF NOT EXISTS reviews (
            user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
            course_id uuid NOT NULL REFERENCES courses(id) ON DELETE cascade,
            rating integer NOT NULL,
            body text,
            created_at timestamp DEFAULT now() NOT NULL,
            updated_at timestamp DEFAULT now() NOT NULL,
            PRIMARY KEY(user_id, course_id)
        )
    `;
    await sql`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS drip_days integer`;
    console.log('Migration done!');
    await sql.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
