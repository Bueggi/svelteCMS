<script lang="ts">
    import { FileText, Download, ExternalLink, Eye, RefreshCw } from 'lucide-svelte';
    import { PageContainer } from '$lib/components/ui/page-container';
    import { PageHeader } from '$lib/components/ui/page-header';
    import { Table, TableHeader, TableBody, TableHead } from '$lib/components/ui/table';
    import { StatusBadge } from '$lib/components/ui/status-badge';
    import { Button } from '$lib/components/ui/button';
    import { invalidateAll } from '$app/navigation';

    let { data } = $props();

    let regenerating = $state(false);
    let regenResult = $state<{ updated: number; errors: number } | null>(null);

    async function regenerateAll() {
        regenerating = true;
        regenResult = null;
        try {
            const res = await fetch('/api/invoices/regenerate', { method: 'POST' });
            regenResult = await res.json();
            await invalidateAll();
        } finally {
            regenerating = false;
        }
    }

    const STATUS_LABELS: Record<string, string> = {
        issued: 'Ausgestellt',
        paid: 'Bezahlt',
        void: 'Storniert',
        refunded: 'Rückerstattet',
    };
    const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
        issued: 'success',
        paid: 'success',
        void: 'default',
        refunded: 'warning',
    };
    const TYPE_LABELS: Record<string, string> = {
        one_time: 'Einmalkauf',
        subscription: 'Abo',
        installment: 'Ratenzahlung',
    };

    function formatAmount(cents: number, currency: string) {
        return (cents / 100).toLocaleString('de-DE', {
            style: 'currency',
            currency: currency.toUpperCase(),
            minimumFractionDigits: 2,
        });
    }

    function formatDate(d: string | Date) {
        return new Date(d).toLocaleDateString('de-DE');
    }
</script>

<PageContainer variant="admin">
    <PageHeader
        title="Rechnungen"
        description="Alle ausgestellten Rechnungen auf einen Blick."
    >
        {#snippet actions()}
            <a
                href="/admin/settings?tab=invoices"
                class="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
                <FileText class="w-4 h-4" />
                Vorlage bearbeiten
            </a>
            <Button
                variant="outline"
                disabled={regenerating}
                onclick={regenerateAll}
            >
                <RefreshCw class="w-4 h-4 mr-2 {regenerating ? 'animate-spin' : ''}" />
                {regenerating ? 'Wird neu generiert...' : 'Alle neu generieren'}
            </Button>
        {/snippet}
    </PageHeader>

    {#if regenResult}
        <div class="rounded-lg border px-4 py-3 text-sm flex items-center gap-2 {regenResult.errors > 0 ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-green-500/30 bg-green-500/5 text-green-700'}">
            <RefreshCw class="w-4 h-4 shrink-0" />
            {regenResult.updated} Rechnungen neu generiert
            {#if regenResult.errors > 0}— {regenResult.errors} Fehler{/if}.
            Alle offenen PDFs im Browser neu laden, um das neue Design zu sehen.
        </div>
    {/if}

    {#if data.invoiceList.length === 0}
        <div class="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
            <FileText class="w-12 h-12 mb-4 opacity-30" />
            <p class="text-lg font-medium">Noch keine Rechnungen vorhanden.</p>
            <p class="text-sm mt-1">Rechnungen werden automatisch bei jedem Kauf erstellt.</p>
        </div>
    {:else}
        <Table>
            <TableHeader>
                <tr>
                    <TableHead>Rechnungsnr.</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead class="text-right"></TableHead>
                </tr>
            </TableHeader>
            <TableBody>
                {#each data.invoiceList as inv}
                    <tr class="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td class="px-4 py-3 font-mono text-sm font-medium">{inv.invoiceNumber}</td>
                        <td class="px-4 py-3 text-sm text-muted-foreground">{formatDate(inv.invoiceDate)}</td>
                        <td class="px-4 py-3">
                            <div class="text-sm font-medium">{inv.customerName || inv.user?.name || '—'}</div>
                            <div class="text-xs text-muted-foreground">{inv.customerEmail || inv.user?.email || ''}</div>
                        </td>
                        <td class="px-4 py-3 text-sm font-semibold tabular-nums">
                            {formatAmount(inv.totalCents, inv.currency)}
                        </td>
                        <td class="px-4 py-3 text-sm text-muted-foreground">{TYPE_LABELS[inv.type] ?? inv.type}</td>
                        <td class="px-4 py-3">
                            <StatusBadge
                                status={inv.status}
                                label={STATUS_LABELS[inv.status] ?? inv.status}
                                variant={STATUS_VARIANTS[inv.status] ?? 'default'}
                            />
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2 justify-end">
                                <a
                                    href="/api/invoices/{inv.id}"
                                    target="_blank"
                                    class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
                                    title="Vorschau"
                                >
                                    <Eye class="w-3 h-3" />
                                    Vorschau
                                </a>
                                <a
                                    href="/api/invoices/{inv.id}?print=1"
                                    target="_blank"
                                    class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    title="Als PDF drucken"
                                >
                                    <Download class="w-3 h-3" />
                                    PDF
                                </a>
                                {#if inv.stripePdfUrl}
                                    <a
                                        href={inv.stripePdfUrl}
                                        target="_blank"
                                        class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium border border-border hover:bg-muted/50 transition-colors"
                                        title="Stripe PDF"
                                    >
                                        <ExternalLink class="w-3 h-3" />
                                        Stripe
                                    </a>
                                {/if}
                            </div>
                        </td>
                    </tr>
                {/each}
            </TableBody>
        </Table>
    {/if}
</PageContainer>
