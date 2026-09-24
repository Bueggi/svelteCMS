<script lang="ts">
    import { goto } from '$app/navigation';
    import { AlertTriangle, CheckCircle2, Download, Info, Settings } from 'lucide-svelte';
    import { PageContainer } from '$lib/components/ui/page-container';
    import { PageHeader } from '$lib/components/ui/page-header';
    import { Table, TableHeader, TableBody, TableHead } from '$lib/components/ui/table';
    import { StatCard } from '$lib/components/ui/stat-card';
    import { Input } from '$lib/components/ui/input';

    let { data } = $props();

    const errors = $derived(data.issues.filter((i: { severity: string }) => i.severity === 'error'));
    const warnings = $derived(data.issues.filter((i: { severity: string }) => i.severity === 'warning'));
    const canExport = $derived(data.missing.length === 0 && !data.loadError);

    const euro = (cents: number) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
    const fmtDate = (d: string) => new Date(d).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });

    const TYPE: Record<string, string> = {
        sale: 'Zahlung', refund: 'Erstattung', fee: 'Gebühr', chargeback: 'Chargeback', payout: 'Auszahlung', other: 'Sonstiges',
    };
    const STATUS: Record<string, { label: string; cls: string }> = {
        ok:               { label: 'OK',                cls: 'text-green-600' },
        mismatch:         { label: 'Betrag weicht ab',  cls: 'text-destructive font-medium' },
        missing_document: { label: 'Beleg fehlt',       cls: 'text-destructive font-medium' },
        unassigned:       { label: 'Nicht zugeordnet',  cls: 'text-destructive font-medium' },
        not_booked:       { label: 'über Kontoauszug',  cls: 'text-muted-foreground' },
    };

    function exportUrl(force = false) {
        return `/admin/accounting/export?month=${data.month}${force ? '&force=1' : ''}`;
    }
</script>

<PageContainer variant="admin">
    <PageHeader
        title="Buchhaltung & DATEV"
        description="Monatlicher Abgleich aller Zahlungen mit den Rechnungen und Export für den Steuerberater."
    >
        {#snippet actions()}
            <Input
                type="month"
                value={data.month}
                class="w-44"
                onchange={(e: Event) => goto(`?month=${(e.currentTarget as HTMLInputElement).value}`)}
            />
        {/snippet}
    </PageHeader>

    {#if data.missing.length > 0}
        <div class="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/10 px-5 py-4 text-sm space-y-2">
            <div class="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                <Settings class="w-4 h-4" /> Für den DATEV-Export fehlen noch Angaben
            </div>
            <p class="text-amber-800/80 dark:text-amber-300/80">{data.missing.join(' · ')}</p>
            <a href="/admin/settings?tab=accounting" class="inline-block text-primary underline">Einstellungen → Buchhaltung öffnen</a>
        </div>
    {/if}

    {#if data.loadError}
        <div class="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            Die Zahlungsdaten konnten nicht geladen werden: {data.loadError}
        </div>
    {:else if data.totals}
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Zahlungseingänge" value={euro(data.totals.stripe.sales + data.totals.paypal.sales)} description="Stripe + PayPal, brutto" />
            <StatCard title="Erstattungen & Chargebacks" value={euro(data.totals.stripe.refunds + data.totals.paypal.refunds + data.totals.stripe.chargebacks + data.totals.paypal.chargebacks)} />
            <StatCard title="Gebühren" value={euro(data.totals.stripe.fees + data.totals.paypal.fees)} />
            <StatCard title="Auszahlungen an die Bank" value={euro(data.totals.stripe.payouts + data.totals.paypal.payouts)} description="kommen über den Kontoauszug" />
        </div>

        <!-- Reconciliation result -->
        {#if errors.length === 0}
            <div class="rounded-xl border border-green-500/30 bg-green-500/5 px-5 py-4 text-sm flex items-start gap-3">
                <CheckCircle2 class="w-5 h-5 text-green-600 shrink-0" />
                <div>
                    <p class="font-medium text-green-700 dark:text-green-400">Abgleich ohne Fehler</p>
                    <p class="text-muted-foreground">
                        Jede Geldbewegung hat einen Beleg mit identischem Betrag, und die Buchungen auf den Geldtransitkonten
                        entsprechen exakt der Saldoänderung bei Stripe und PayPal ({data.bookingCount} Buchungen, {data.documentCount} Belege).
                    </p>
                </div>
            </div>
        {:else}
            <div class="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm space-y-2">
                <div class="flex items-center gap-2 font-medium text-destructive">
                    <AlertTriangle class="w-4 h-4" /> {errors.length} Abweichung{errors.length === 1 ? '' : 'en'} — bitte vor dem Export klären
                </div>
                <ul class="list-disc pl-5 space-y-1 text-destructive/90">
                    {#each errors as issue}<li>{issue.message}</li>{/each}
                </ul>
            </div>
        {/if}

        {#if warnings.length > 0}
            <div class="rounded-xl border border-border bg-muted/30 px-5 py-4 text-sm space-y-2">
                <div class="flex items-center gap-2 font-medium"><Info class="w-4 h-4" /> Hinweise</div>
                <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
                    {#each warnings as issue}<li>{issue.message}</li>{/each}
                </ul>
            </div>
        {/if}

        <div class="flex flex-wrap items-center gap-3">
            {#if canExport && errors.length === 0}
                <a href={exportUrl()} class="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
                    <Download class="w-4 h-4" /> DATEV-Export {data.month} herunterladen
                </a>
            {:else if canExport}
                <a
                    href={exportUrl(true)}
                    onclick={(e) => { if (!confirm('Der Abgleich hat Fehler. Trotzdem exportieren? Die Fehler stehen auch in der Zusammenfassung im ZIP.')) e.preventDefault(); }}
                    class="inline-flex items-center gap-2 rounded-md border border-destructive/40 text-destructive px-4 py-2 text-sm font-medium hover:bg-destructive/5"
                >
                    <Download class="w-4 h-4" /> Trotzdem exportieren
                </a>
            {/if}
            <p class="text-xs text-muted-foreground">
                ZIP mit DATEV-Buchungsstapel, allen Rechnungs-PDFs, Rechnungsausgangsbuch und Abgleichsliste — zum Weiterleiten an den Steuerberater.
            </p>
        </div>

        <!-- Movements -->
        <section class="space-y-2">
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Geldbewegungen im {data.month}</h2>
            {#if data.movements.length === 0}
                <p class="text-sm text-muted-foreground">Keine Bewegungen in diesem Monat.</p>
            {:else}
                <Table>
                    <TableHeader>
                        <tr>
                            <TableHead>Datum</TableHead>
                            <TableHead>Anbieter</TableHead>
                            <TableHead>Typ</TableHead>
                            <TableHead class="text-right">Betrag</TableHead>
                            <TableHead class="text-right">Gebühr</TableHead>
                            <TableHead>Beleg</TableHead>
                            <TableHead>Status</TableHead>
                        </tr>
                    </TableHeader>
                    <TableBody>
                        {#each data.movements as m}
                            <tr class="border-b border-border/50">
                                <td class="px-4 py-2 text-sm whitespace-nowrap">{fmtDate(m.date)}</td>
                                <td class="px-4 py-2 text-sm">{m.provider === 'stripe' ? 'Stripe' : 'PayPal'}</td>
                                <td class="px-4 py-2 text-sm">{TYPE[m.type]}</td>
                                <td class="px-4 py-2 text-sm text-right tabular-nums">{euro(m.amountCents)}</td>
                                <td class="px-4 py-2 text-sm text-right tabular-nums text-muted-foreground">{m.feeCents ? euro(m.feeCents) : ''}</td>
                                <td class="px-4 py-2 text-sm font-mono">{m.documentNumber ?? ''}</td>
                                <td class="px-4 py-2 text-sm {STATUS[m.status].cls}">{STATUS[m.status].label}</td>
                            </tr>
                        {/each}
                    </TableBody>
                </Table>
            {/if}
        </section>
    {/if}
</PageContainer>
