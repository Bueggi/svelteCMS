<script lang="ts">
    import PageBlocks from '$lib/blocks/PageBlocks.svelte';

    let { data } = $props();

    const trialDays = data.funnel.course?.trialDays ?? 0;
    const interval = data.funnel.course?.subscriptionInterval === 'year' ? 'Jahr' : 'Monat';
    const sandboxMode = data.sandboxMode;
</script>

<svelte:head>
    <title>{data.funnel.name}</title>
    {#if data.funnel.trackingPixels}{@html data.funnel.trackingPixels}{/if}
</svelte:head>

{#if sandboxMode}
    <div class="bg-amber-500 text-white text-center py-2 px-4 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
        <span>🧪</span> SANDBOX — Testzahlungen aktiv, kein echtes Geld
    </div>
{/if}

{#if trialDays > 0}
    <div class="bg-primary text-primary-foreground text-center py-2.5 px-4 text-sm font-medium">
        🎉 {trialDays} Tage kostenlos testen — danach automatische Verlängerung pro {interval}
    </div>
{/if}

{#if data.blocks.length > 0}
    <PageBlocks
        blocks={data.blocks}
        courseSlug={data.funnel.course?.slug}
        coursePrice={data.funnel.course?.price}
        courseTitle={data.funnel.course?.title}
        courseThumbnailUrl={data.funnel.course?.thumbnailUrl ?? undefined}
        courseId={data.funnel.course?.id}
        courseUpsells={data.bumpsAsUpsells}
        checkoutMode={data.funnel.checkoutMode}
        enabledMethods={data.enabledMethods}
        vatRate={data.vatRate}
        reverseChargeEnabled={data.reverseChargeEnabled}
        operatorCountry={data.operatorCountry}
        taxRates={data.taxRates}
        funnelSlug={data.funnel.slug}
        funnelCheckoutPageId={data.firstCheckoutPageId ?? undefined}
        {sandboxMode}
    />
{:else}
    <div class="min-h-screen flex items-center justify-center text-muted-foreground">
        <p>Diese Seite ist noch nicht eingerichtet.</p>
    </div>
{/if}
