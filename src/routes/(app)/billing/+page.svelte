<script lang="ts">
    import { PageContainer } from '$lib/components/ui/page-container';
    import { PageHeader } from '$lib/components/ui/page-header';
    import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
    import { StatusBadge } from '$lib/components/ui/status-badge';
    import { Button } from '$lib/components/ui/button';
    import {
        CreditCard, Download, RefreshCw, XCircle, Calendar,
        Receipt, CheckCircle2, AlertCircle, FileText, Sparkles,
    } from 'lucide-svelte';
    import { invalidateAll } from '$app/navigation';

    let { data } = $props();

    const purchases     = $derived(data.purchases     ?? []);
    const subscriptions = $derived(data.subscriptions ?? []);
    const invoiceList   = $derived(data.invoiceList   ?? []);

    // invoices tied to a one-time purchase
    const invoiceByPurchaseId = $derived(
        new Map(invoiceList.map((inv: any) => [inv.purchaseId, inv]))
    );

    // standalone subscription invoices (no purchaseId)
    const subscriptionInvoices = $derived(
        invoiceList
            .filter((inv: any) => inv.type === 'subscription')
            .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
    );

    // ── Cancel / reactivate state ─────────────────────────────────────────────
    let actionInProgress = $state<string | null>(null); // courseId being acted on
    let feedbackMap = $state<Record<string, { type: 'success' | 'error'; message: string }>>({});

    async function cancelSubscription(courseId: string) {
        actionInProgress = courseId;
        try {
            const res = await fetch('/api/subscriptions/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId }),
            });
            if (!res.ok) throw new Error((await res.json()).message ?? 'Fehler');
            feedbackMap = { ...feedbackMap, [courseId]: { type: 'success', message: 'Kündigung vorgemerkt — Zugang bleibt bis zum Periodenende aktiv.' } };
            await invalidateAll();
        } catch (e: any) {
            feedbackMap = { ...feedbackMap, [courseId]: { type: 'error', message: e.message } };
        } finally {
            actionInProgress = null;
        }
    }

    async function reactivate(courseId: string) {
        actionInProgress = courseId;
        try {
            const res = await fetch('/api/subscriptions/cancel', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId }),
            });
            if (!res.ok) throw new Error((await res.json()).message ?? 'Fehler');
            feedbackMap = { ...feedbackMap, [courseId]: { type: 'success', message: 'Abo erfolgreich reaktiviert.' } };
            await invalidateAll();
        } catch (e: any) {
            feedbackMap = { ...feedbackMap, [courseId]: { type: 'error', message: e.message } };
        } finally {
            actionInProgress = null;
        }
    }

    // ── Formatters ────────────────────────────────────────────────────────────
    function fmtDate(d: string | Date | null | undefined) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    function fmtDateShort(d: string | Date | null | undefined) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function fmtCents(cents: number, currency = 'EUR') {
        return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency });
    }

    function invoiceItemLabel(inv: any) {
        try { return JSON.parse(inv.items)[0]?.description ?? 'Abo-Zahlung'; } catch { return 'Abo-Zahlung'; }
    }
</script>

<PageContainer>
    <PageHeader
        title="Meine Abrechnung"
        description="Abonnements, Käufe und Rechnungen auf einen Blick."
    />

    <!-- ── Active Subscriptions ───────────────────────────────────────────── -->
    {#if subscriptions.length > 0}
        <section class="space-y-3">
            <div class="flex items-center gap-2 mb-1">
                <RefreshCw class="w-4 h-4 text-primary" />
                <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Aktive Abonnements</h2>
            </div>

            {#each subscriptions as sub}
                {@const busy     = actionInProgress === sub.courseId}
                {@const feedback = feedbackMap[sub.courseId] ?? null}
                {@const willEnd  = sub.cancelAtPeriodEnd}

                <div class="rounded-xl border {willEnd ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card/60'} p-5 shadow-sm space-y-4">
                    <!-- Header row -->
                    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <Sparkles class="w-4 h-4 text-primary shrink-0" />
                                <span class="font-semibold text-base">{sub.course?.title ?? 'Mitgliedschaft'}</span>
                                {#if willEnd}
                                    <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Kündigung vorgemerkt</span>
                                {:else}
                                    <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">Aktiv</span>
                                {/if}
                            </div>

                            {#if sub.currentPeriodEnd}
                                <p class="text-sm text-muted-foreground flex items-center gap-1.5 pl-6">
                                    <Calendar class="w-3.5 h-3.5" />
                                    {#if willEnd}
                                        Zugang endet am <strong class="text-foreground">{fmtDate(sub.currentPeriodEnd)}</strong>
                                    {:else}
                                        Nächste Abbuchung am <strong class="text-foreground">{fmtDate(sub.currentPeriodEnd)}</strong>
                                    {/if}
                                </p>
                            {/if}
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-2 shrink-0">
                            {#if willEnd}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onclick={() => reactivate(sub.courseId)}
                                >
                                    {#if busy}
                                        <RefreshCw class="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    {/if}
                                    Kündigung rückgängig machen
                                </Button>
                            {:else}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="text-destructive hover:text-destructive hover:bg-destructive/10 border border-destructive/20"
                                    disabled={busy}
                                    onclick={() => cancelSubscription(sub.courseId)}
                                >
                                    {#if busy}
                                        <RefreshCw class="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    {:else}
                                        <XCircle class="w-3.5 h-3.5 mr-1.5" />
                                    {/if}
                                    Abo kündigen
                                </Button>
                            {/if}
                        </div>
                    </div>

                    <!-- Cancel note -->
                    {#if willEnd}
                        <div class="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                            Du hast dieses Abo gekündigt. Du hast weiterhin vollen Zugang bis zum Ende des aktuellen Abrechnungszeitraums. Danach wird dein Zugang automatisch beendet.
                        </div>
                    {/if}

                    <!-- Feedback -->
                    {#if feedback}
                        <div class="flex items-center gap-2 text-sm {feedback.type === 'success' ? 'text-green-600' : 'text-destructive'}">
                            {#if feedback.type === 'success'}
                                <CheckCircle2 class="w-4 h-4 shrink-0" />
                            {:else}
                                <AlertCircle class="w-4 h-4 shrink-0" />
                            {/if}
                            {feedback.message}
                        </div>
                    {/if}
                </div>
            {/each}
        </section>
    {/if}

    <!-- ── Subscription Invoice History ──────────────────────────────────── -->
    {#if subscriptionInvoices.length > 0}
        <section class="space-y-3">
            <div class="flex items-center gap-2 mb-1">
                <Receipt class="w-4 h-4 text-primary" />
                <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Abo-Rechnungen</h2>
            </div>

            <div class="rounded-xl border border-border overflow-hidden bg-card/60 shadow-sm">
                <Table>
                    <TableHeader>
                        <tr>
                            <TableHead>Rechnungsnr.</TableHead>
                            <TableHead>Datum</TableHead>
                            <TableHead>Beschreibung</TableHead>
                            <TableHead>Betrag</TableHead>
                            <TableHead class="text-right">PDF</TableHead>
                        </tr>
                    </TableHeader>
                    <TableBody>
                        {#each subscriptionInvoices as inv}
                            <TableRow>
                                <TableCell class="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                                <TableCell class="whitespace-nowrap text-muted-foreground">{fmtDateShort(inv.invoiceDate)}</TableCell>
                                <TableCell class="text-sm">{invoiceItemLabel(inv)}</TableCell>
                                <TableCell class="font-mono font-medium">{fmtCents(inv.totalCents, inv.currency)}</TableCell>
                                <TableCell class="text-right">
                                    <a
                                        href="/api/invoices/{inv.id}?print=1"
                                        target="_blank"
                                        class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
                                    >
                                        <Download class="w-3 h-3" /> PDF
                                    </a>
                                </TableCell>
                            </TableRow>
                        {/each}
                    </TableBody>
                </Table>
            </div>
        </section>
    {/if}

    <!-- ── One-time Purchases ─────────────────────────────────────────────── -->
    <section class="space-y-3">
        <div class="flex items-center gap-2 mb-1">
            <CreditCard class="w-4 h-4 text-primary" />
            <h2 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Einmalzahlungen</h2>
        </div>

        {#if purchases.length === 0}
            <div class="rounded-xl border border-border bg-card/60 flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
                <FileText class="w-10 h-10 opacity-20" />
                <p class="font-medium">Noch keine Käufe</p>
                <p class="text-sm opacity-60">Deine künftigen Käufe erscheinen hier.</p>
            </div>
        {:else}
            <div class="rounded-xl border border-border overflow-hidden bg-card/60 shadow-sm">
                <Table>
                    <TableHeader>
                        <tr>
                            <TableHead>Datum</TableHead>
                            <TableHead>Kurs</TableHead>
                            <TableHead>Betrag</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead class="text-right">Rechnung</TableHead>
                        </tr>
                    </TableHeader>
                    <TableBody>
                        {#each purchases as purchase}
                            {@const inv = invoiceByPurchaseId.get(purchase.id)}
                            <TableRow>
                                <TableCell class="whitespace-nowrap text-muted-foreground">
                                    {fmtDateShort(purchase.createdAt)}
                                </TableCell>
                                <TableCell class="font-medium">{purchase.course.title}</TableCell>
                                <TableCell class="font-mono">{fmtCents(purchase.amount)}</TableCell>
                                <TableCell><StatusBadge status={purchase.status} /></TableCell>
                                <TableCell class="text-right">
                                    {#if inv}
                                        <a
                                            href="/api/invoices/{inv.id}?print=1"
                                            target="_blank"
                                            class="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
                                        >
                                            <Download class="w-3 h-3" /> PDF
                                        </a>
                                    {:else}
                                        <span class="text-xs text-muted-foreground/40">—</span>
                                    {/if}
                                </TableCell>
                            </TableRow>
                        {/each}
                    </TableBody>
                </Table>
            </div>
        {/if}
    </section>
</PageContainer>
