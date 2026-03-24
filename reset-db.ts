/**
 * reset-db.ts
 *
 * Wipes all user-generated content from the database while preserving the
 * schema structure. Run this to get a completely clean state (e.g. before
 * handing the project to a new customer).
 *
 * ⚠️  This is DESTRUCTIVE and irreversible. Back up your data first!
 *
 * Run with:  npx tsx reset-db.ts
 *            npx tsx reset-db.ts --yes   (skip confirmation prompt)
 */
import 'dotenv/config';
import postgres from 'postgres';
import * as readline from 'readline';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

async function confirm(): Promise<boolean> {
    if (process.argv.includes('--yes')) return true;

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(
            '⚠️  This will DELETE ALL data (users, courses, purchases, uploads, settings).\nType "reset" to confirm: ',
            answer => {
                rl.close();
                resolve(answer.trim() === 'reset');
            },
        );
    });
}

async function main() {
    const ok = await confirm();
    if (!ok) {
        console.log('Aborted.');
        process.exit(0);
    }

    const sql = postgres(databaseUrl!);

    console.log('\n🗑️  Resetting database...\n');

    // Order matters — respect FK constraints (children before parents)
    const tables = [
        // Auth
        'verification',
        'session',
        'account',

        // Community
        'community_comments',
        'community_posts',
        'community_categories',

        // Progress & enrollments
        'user_progress',
        'event_registrations',
        'enrollments',

        // Commerce
        'automation_logs',
        'inbound_webhook_logs',
        'invoices',
        'purchases',
        'reviews',
        'module_ratings',

        // Funnels
        'funnel_checkout_pages',
        'funnel_upsells',
        'funnel_bumps',
        'funnels',

        // Courses
        'upsells',
        'coupons',
        'lessons',
        'modules',
        'course_moderators',
        'courses',

        // Automations
        'automations',
        'inbound_webhooks',

        // Media & calendar
        'media_files',
        'calendar_events',

        // Tax
        'tax_rates',

        // Settings (reset to factory defaults)
        'site_settings',

        // Users last
        '"user"',
    ];

    for (const table of tables) {
        try {
            await sql.unsafe(`DELETE FROM ${table}`);
            console.log(`  ✅  Cleared ${table}`);
        } catch (err: any) {
            console.warn(`  ⚠️  Skipped ${table}: ${err.message}`);
        }
    }

    await sql.end();

    console.log('\n✅  Database reset complete. Run the app and go through the setup wizard.\n');
    process.exit(0);
}

main().catch(err => {
    console.error('❌  Reset failed:', err);
    process.exit(1);
});
