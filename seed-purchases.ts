/**
 * seed-purchases.ts
 *
 * Seeds test purchases AND invoices for a given user:
 *   - 2 one-time course purchases (lifetime access)
 *   - 1 monthly subscription with 3 past payments → 3 invoices
 *
 * Run with:  npx tsx seed-purchases.ts
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import * as schema from './src/lib/server/db/schema';
import { DEFAULT_INVOICE_TEMPLATE } from './src/lib/server/invoiceTemplate';

// ── DB setup ───────────────────────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');
const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

// ── Invoice helpers (inlined — avoids $lib alias issues in tsx) ────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatCents(cents: number): string {
    return (cents / 100).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface InvoiceItem {
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
}

function renderInvoiceHtml(data: {
    invoiceNumber: string;
    invoiceDate: string;
    companyName: string;
    companyAddress: string;
    companyVatId: string;
    companyEmail: string;
    companyPhone: string;
    customerName: string;
    customerEmail: string;
    customerAddress: string;
    customerVatId: string;
    items: InvoiceItem[];
    subtotalCents: number;
    vatRate: number;
    vatCents: number;
    totalCents: number;
    currency: string;
    isReverseCharge: boolean;
    notes: string;
}, template?: string | null): string {
    const tpl = template || DEFAULT_INVOICE_TEMPLATE;
    const sym = '€';

    const itemsRows = data.items.map(item => `
    <tr>
      <td class="item-desc">${escapeHtml(item.description)}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${sym}${formatCents(item.unitPriceCents)}</td>
      <td style="text-align:right">${sym}${formatCents(item.totalCents)}</td>
    </tr>`).join('');

    const vatRow = data.isReverseCharge
        ? `<div class="totals-row"><span>MwSt. (0 % — Reverse Charge)</span><span>${sym}0,00</span></div>`
        : `<div class="totals-row"><span>MwSt. (${data.vatRate} %)</span><span>${sym}${formatCents(data.vatCents)}</span></div>`;

    const reverseChargeRow = data.isReverseCharge
        ? `<div class="totals-row reverse-charge"><span>Steuerschuldnerschaft des Leistungsempfängers (§13b UStG)</span></div>`
        : '';

    const customerVatIdRow = data.customerVatId
        ? `<br>USt-IdNr.: ${escapeHtml(data.customerVatId)}`
        : '';

    const vars: Record<string, string> = {
        invoice_number: escapeHtml(data.invoiceNumber),
        invoice_date: escapeHtml(data.invoiceDate),
        company_name: escapeHtml(data.companyName),
        company_address: data.companyAddress,
        company_vat_id: data.companyVatId ? `USt-IdNr.: ${escapeHtml(data.companyVatId)}` : '',
        company_email: data.companyEmail ? escapeHtml(data.companyEmail) : '',
        company_phone: data.companyPhone ? ` · ${escapeHtml(data.companyPhone)}` : '',
        customer_name: escapeHtml(data.customerName),
        customer_email: escapeHtml(data.customerEmail),
        customer_address: data.customerAddress,
        customer_vat_id_row: customerVatIdRow,
        items_rows: itemsRows,
        subtotal: formatCents(data.subtotalCents),
        vat_rate: String(data.vatRate),
        vat_amount: formatCents(data.vatCents),
        vat_row: vatRow,
        total: formatCents(data.totalCents),
        currency_symbol: sym,
        reverse_charge_row: reverseChargeRow,
        notes: data.notes || '',
    };

    return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

async function generateInvoiceNumber(db: any): Promise<string> {
    const [row] = await db
        .update(schema.siteSettings)
        .set({ invoiceNextNumber: sql`${schema.siteSettings.invoiceNextNumber} + 1` })
        .where(eq(schema.siteSettings.id, 1))
        .returning({
            num: schema.siteSettings.invoiceNextNumber,
            prefix: schema.siteSettings.invoicePrefix,
        });

    if (!row) throw new Error('siteSettings row not found');
    const issuedNum = row.num - 1;
    const year = new Date().getFullYear();
    return `${row.prefix}-${year}-${String(issuedNum).padStart(4, '0')}`;
}

// ── Main seed ──────────────────────────────────────────────────────────────────

async function seed() {
    const targetEmail = process.argv[2];
    if (!targetEmail) {
        console.error('Usage: npx tsx seed-purchases.ts <email>');
        process.exit(1);
    }

    console.log(`\n🌱  Seeding purchases & invoices for ${targetEmail}\n`);

    // ── 1. Find the target user ─────────────────────────────────────────────────
    const targetUser = await db.query.user.findFirst({
        where: eq(schema.user.email, targetEmail),
    });
    if (!targetUser) {
        console.error(`❌  User ${targetEmail} not found. Please log in once to create the account first.`);
        process.exit(1);
    }
    console.log(`✅  Found user: ${targetUser.name} (${targetUser.id})`);

    // ── 2. Ensure siteSettings row exists (needed for invoice counter) ──────────
    const existingSettings = await db.query.siteSettings.findFirst();
    if (!existingSettings) {
        console.log('⚙️   Creating siteSettings row…');
        await db.insert(schema.siteSettings).values({
            id: 1,
            appName: 'LUMIÈRE',
            companyName: 'LUMIÈRE GmbH',
            companyStreet: 'Musterstraße 1',
            companyCity: 'Berlin',
            companyZip: '10115',
            companyCountry: 'DE',
            companyVatId: 'DE123456789',
            companyEmail: 'info@lumiere.de',
            vatRate: 19,
            invoicePrefix: 'INV',
            invoiceNextNumber: 1,
        });
        console.log('✅  siteSettings created.');
    } else {
        console.log('✅  siteSettings exists (invoice counter: ' + existingSettings.invoiceNextNumber + ')');
    }

    const settings = (await db.query.siteSettings.findFirst())!;

    // ── 3. Ensure instructor exists ─────────────────────────────────────────────
    const instructorId = 'instructor-seed-1';
    await db.insert(schema.user).values({
        id: instructorId,
        name: 'LUMIÈRE Academy',
        email: 'instructor@lumiere.de',
        emailVerified: true,
        role: 'instructor',
        createdAt: new Date(),
        updatedAt: new Date(),
    }).onConflictDoNothing();

    // ── 4. Find or create courses ───────────────────────────────────────────────

    // One-time course A
    let courseA = await db.query.courses.findFirst({
        where: eq(schema.courses.slug, 'skincare-masterclass'),
    });
    if (!courseA) {
        const [c] = await db.insert(schema.courses).values({
            title: 'Skincare Masterclass',
            slug: 'skincare-masterclass',
            subtitle: 'Dein kompletter Skincare-Guide',
            description: 'Lerne alles über professionelle Hautpflege.',
            price: 19700, // 197 €
            isPublished: true,
            accessType: 'lifetime',
            instructorId,
        }).returning();
        courseA = c;
        console.log('✅  Created one-time course: Skincare Masterclass (197 €)');
    } else {
        console.log('✅  Found existing course: ' + courseA.title);
    }

    // One-time course B
    let courseB = await db.query.courses.findFirst({
        where: eq(schema.courses.slug, 'anti-aging-deep-dive'),
    });
    if (!courseB) {
        const [c] = await db.insert(schema.courses).values({
            title: 'Anti-Aging Deep Dive',
            slug: 'anti-aging-deep-dive',
            subtitle: 'Wissenschaftlich fundierte Anti-Aging-Strategien',
            description: 'Fortgeschrittene Anti-Aging-Methoden und Inhaltsstoffe.',
            price: 29700, // 297 €
            isPublished: true,
            accessType: 'lifetime',
            instructorId,
        }).returning();
        courseB = c;
        console.log('✅  Created one-time course: Anti-Aging Deep Dive (297 €)');
    } else {
        console.log('✅  Found existing course: ' + courseB.title);
    }

    // Subscription course
    let courseSub = await db.query.courses.findFirst({
        where: eq(schema.courses.slug, 'lumiere-membership'),
    });
    if (!courseSub) {
        const [c] = await db.insert(schema.courses).values({
            title: 'LUMIÈRE Membership',
            slug: 'lumiere-membership',
            subtitle: 'Monatliches Skincare-Coaching',
            description: 'Exklusiver Zugang zu neuen Inhalten und Live-Sessions jeden Monat.',
            price: 4900, // 49 €/Monat
            isPublished: true,
            accessType: 'subscription',
            subscriptionInterval: 'month',
            instructorId,
        }).returning();
        courseSub = c;
        console.log('✅  Created subscription course: LUMIÈRE Membership (49 €/Monat)');
    } else {
        console.log('✅  Found existing course: ' + courseSub.title);
    }

    // ── Helper: company block ───────────────────────────────────────────────────
    const companyAddress = [
        settings.companyStreet,
        [settings.companyZip, settings.companyCity].filter(Boolean).join(' '),
        settings.companyCountry,
    ].filter(Boolean).join('<br>');

    const customerAddress = 'Teststraße 42<br>80333 München<br>DE';
    const customerName = targetUser.name || targetUser.email;
    const customerEmail = targetUser.email;
    const vatRate = settings.vatRate ?? 19;

    // ── 5. ONE-TIME PURCHASE A: Skincare Masterclass ────────────────────────────
    console.log('\n📦  Creating one-time purchase: Skincare Masterclass…');

    const purchaseAId = uuidv4();
    const totalA = courseA.price; // 19700
    const vatA = Math.round(totalA - totalA / (1 + vatRate / 100));
    const subtotalA = totalA - vatA;

    await db.insert(schema.purchases).values({
        id: purchaseAId,
        userId: targetUser.id,
        courseId: courseA.id,
        stripeCheckoutSessionId: `seed_cs_${purchaseAId}`,
        amount: totalA,
        status: 'completed',
    }).onConflictDoNothing();

    await db.insert(schema.enrollments).values({
        userId: targetUser.id,
        courseId: courseA.id,
        status: 'active',
    }).onConflictDoNothing();

    const invNumA = await generateInvoiceNumber(db);
    const invoiceDateA = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const htmlA = renderInvoiceHtml({
        invoiceNumber: invNumA,
        invoiceDate: formatDate(invoiceDateA),
        companyName: settings.companyName || settings.appName,
        companyAddress,
        companyVatId: settings.companyVatId || '',
        companyEmail: settings.companyEmail || '',
        companyPhone: settings.companyPhone || '',
        customerName,
        customerEmail,
        customerAddress,
        customerVatId: '',
        items: [{ description: courseA.title, quantity: 1, unitPriceCents: subtotalA, totalCents: subtotalA }],
        subtotalCents: subtotalA,
        vatRate,
        vatCents: vatA,
        totalCents: totalA,
        currency: 'eur',
        isReverseCharge: false,
        notes: settings.invoiceFooter || '',
    }, settings.invoiceTemplate);

    await db.insert(schema.invoices).values({
        invoiceNumber: invNumA,
        purchaseId: purchaseAId,
        userId: targetUser.id,
        customerName,
        customerEmail,
        customerAddressJson: JSON.stringify({ line1: 'Teststraße 42', city: 'München', postal_code: '80333', country: 'DE' }),
        items: JSON.stringify([{ description: courseA.title, quantity: 1, unitPriceCents: subtotalA, totalCents: subtotalA }]),
        subtotalCents: subtotalA,
        vatRate,
        vatCents: vatA,
        totalCents: totalA,
        currency: 'eur',
        isReverseCharge: false,
        htmlSnapshot: htmlA,
        status: 'issued',
        type: 'one_time',
        invoiceDate: invoiceDateA,
    });
    console.log(`   ✅  Invoice ${invNumA} (${(totalA / 100).toFixed(2)} €) created.`);

    // ── 6. ONE-TIME PURCHASE B: Anti-Aging Deep Dive ────────────────────────────
    console.log('\n📦  Creating one-time purchase: Anti-Aging Deep Dive…');

    const purchaseBId = uuidv4();
    const totalB = courseB.price; // 29700
    const vatB = Math.round(totalB - totalB / (1 + vatRate / 100));
    const subtotalB = totalB - vatB;

    await db.insert(schema.purchases).values({
        id: purchaseBId,
        userId: targetUser.id,
        courseId: courseB.id,
        stripeCheckoutSessionId: `seed_cs_${purchaseBId}`,
        amount: totalB,
        status: 'completed',
    }).onConflictDoNothing();

    await db.insert(schema.enrollments).values({
        userId: targetUser.id,
        courseId: courseB.id,
        status: 'active',
    }).onConflictDoNothing();

    const invNumB = await generateInvoiceNumber(db);
    const invoiceDateB = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
    const htmlB = renderInvoiceHtml({
        invoiceNumber: invNumB,
        invoiceDate: formatDate(invoiceDateB),
        companyName: settings.companyName || settings.appName,
        companyAddress,
        companyVatId: settings.companyVatId || '',
        companyEmail: settings.companyEmail || '',
        companyPhone: settings.companyPhone || '',
        customerName,
        customerEmail,
        customerAddress,
        customerVatId: '',
        items: [{ description: courseB.title, quantity: 1, unitPriceCents: subtotalB, totalCents: subtotalB }],
        subtotalCents: subtotalB,
        vatRate,
        vatCents: vatB,
        totalCents: totalB,
        currency: 'eur',
        isReverseCharge: false,
        notes: settings.invoiceFooter || '',
    }, settings.invoiceTemplate);

    await db.insert(schema.invoices).values({
        invoiceNumber: invNumB,
        purchaseId: purchaseBId,
        userId: targetUser.id,
        customerName,
        customerEmail,
        customerAddressJson: JSON.stringify({ line1: 'Teststraße 42', city: 'München', postal_code: '80333', country: 'DE' }),
        items: JSON.stringify([{ description: courseB.title, quantity: 1, unitPriceCents: subtotalB, totalCents: subtotalB }]),
        subtotalCents: subtotalB,
        vatRate,
        vatCents: vatB,
        totalCents: totalB,
        currency: 'eur',
        isReverseCharge: false,
        htmlSnapshot: htmlB,
        status: 'issued',
        type: 'one_time',
        invoiceDate: invoiceDateB,
    });
    console.log(`   ✅  Invoice ${invNumB} (${(totalB / 100).toFixed(2)} €) created.`);

    // ── 7. SUBSCRIPTION: LUMIÈRE Membership — 3 monthly payments ───────────────
    console.log('\n🔄  Creating subscription with 3 monthly payments…');

    const fakeSubId = `sub_seed_${uuidv4().slice(0, 8)}`;
    const subPrice = courseSub.price; // 4900

    await db.insert(schema.enrollments).values({
        userId: targetUser.id,
        courseId: courseSub.id,
        status: 'active',
        stripeSubscriptionId: fakeSubId,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }).onConflictDoNothing();

    // 3 monthly invoice cycles (3 months ago, 2 months ago, 1 month ago)
    const paymentDates = [
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    ];

    for (let i = 0; i < paymentDates.length; i++) {
        const payDate = paymentDates[i];
        const vatSub = Math.round(subPrice - subPrice / (1 + vatRate / 100));
        const subtotalSub = subPrice - vatSub;
        const monthLabel = payDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

        const invNumSub = await generateInvoiceNumber(db);
        const desc = `${courseSub.title} — Abo ${monthLabel}`;
        const htmlSub = renderInvoiceHtml({
            invoiceNumber: invNumSub,
            invoiceDate: formatDate(payDate),
            companyName: settings.companyName || settings.appName,
            companyAddress,
            companyVatId: settings.companyVatId || '',
            companyEmail: settings.companyEmail || '',
            companyPhone: settings.companyPhone || '',
            customerName,
            customerEmail,
            customerAddress,
            customerVatId: '',
            items: [{ description: desc, quantity: 1, unitPriceCents: subtotalSub, totalCents: subtotalSub }],
            subtotalCents: subtotalSub,
            vatRate,
            vatCents: vatSub,
            totalCents: subPrice,
            currency: 'eur',
            isReverseCharge: false,
            notes: settings.invoiceFooter || '',
        }, settings.invoiceTemplate);

        await db.insert(schema.invoices).values({
            invoiceNumber: invNumSub,
            userId: targetUser.id,
            customerName,
            customerEmail,
            customerAddressJson: JSON.stringify({ line1: 'Teststraße 42', city: 'München', postal_code: '80333', country: 'DE' }),
            items: JSON.stringify([{ description: desc, quantity: 1, unitPriceCents: subtotalSub, totalCents: subtotalSub }]),
            subtotalCents: subtotalSub,
            vatRate,
            vatCents: vatSub,
            totalCents: subPrice,
            currency: 'eur',
            isReverseCharge: false,
            stripeInvoiceId: `in_seed_${fakeSubId}_${i + 1}`,
            htmlSnapshot: htmlSub,
            status: 'paid',
            type: 'subscription',
            invoiceDate: payDate,
        });

        console.log(`   ✅  Subscription invoice ${invNumSub} — ${monthLabel} (${(subPrice / 100).toFixed(2)} €) created.`);
    }

    // ── Summary ─────────────────────────────────────────────────────────────────
    const totalInvoices = await db.query.invoices.findMany({
        where: eq(schema.invoices.userId, targetUser.id),
    });

    console.log(`
╔══════════════════════════════════════════════════════╗
║  ✅  Seed complete for ${customerEmail.padEnd(28)}║
╠══════════════════════════════════════════════════════╣
║  One-time purchases : 2                              ║
║  Subscription       : 1 (3 monthly payments)         ║
║  Total invoices     : ${String(totalInvoices.length).padEnd(29)}║
╚══════════════════════════════════════════════════════╝
`);

    await client.end();
    process.exit(0);
}

seed().catch(err => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
});
