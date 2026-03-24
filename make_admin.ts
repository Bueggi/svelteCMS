import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
}

const email = process.argv[2];
if (!email) {
    console.error('Usage: npx tsx make_admin.ts <email>');
    process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
    console.log(`Promoting ${email} to admin...`);

    try {
        const result = await sql`
            UPDATE "user"
            SET role = 'admin'
            WHERE email = ${email}
            RETURNING *
        `;

        if (result.length > 0) {
            console.log('Success! User updated:', result[0]);
        } else {
            console.log('User not found.');
        }
    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await sql.end();
    }
}

main();
