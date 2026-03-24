<script lang="ts">
    import PageBlocks from '$lib/blocks/PageBlocks.svelte';
    import { Button } from '$lib/components/ui/button';
    import { ArrowRight, X } from 'lucide-svelte';

    let { data } = $props();
    let funnel = $derived(data.funnel);
    let upsell = $derived(data.upsell);
    let nextUpsell = $derived(data.nextUpsell);
    let isLoading = $state(false);
    let isDeclining = $state(false);

    function formatPrice(cents: number) {
        return '€' + (cents / 100).toFixed(2).replace('.', ',');
    }

    function nextUrl() {
        if (nextUpsell) return `/f/${funnel.slug}/u/${nextUpsell.id}`;
        return `/f/${funnel.slug}/thank-you`;
    }

    async function accept() {
        isLoading = true;
        const res = await fetch('/api/stripe/upsell-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                courseId: upsell.course.id,
                funnelSlug: funnel.slug,
                upsellId: upsell.id,
                specialPrice: upsell.specialPrice,
                nextUrl: nextUrl(),
            }),
        });
        const result = await res.json();
        if (result.url) window.location.href = result.url;
        else isLoading = false;
    }

    function decline() {
        isDeclining = true;
        window.location.href = nextUrl();
    }
</script>

<svelte:head>
    <title>{upsell.course?.title ?? 'Special Offer'}</title>
    {#if funnel.trackingPixels}{@html funnel.trackingPixels}{/if}
</svelte:head>

{#if upsell.blocks && JSON.parse(upsell.blocks).length > 0}
    <PageBlocks
        blocks={JSON.parse(upsell.blocks)}
        courseSlug={upsell.course?.slug}
        courseTitle={upsell.course?.title}
        courseId={upsell.course?.id}
    />
    <!-- Accept / Decline actions below the page builder content -->
    <div class="py-10 px-4 text-center space-y-4 border-t bg-background">
        <div class="flex items-baseline justify-center gap-3">
            {#if upsell.specialPrice != null && upsell.course && upsell.specialPrice < upsell.course.price}
                <span class="text-3xl font-bold text-primary">{formatPrice(upsell.specialPrice)}</span>
                <span class="text-lg text-muted-foreground line-through">{formatPrice(upsell.course.price)}</span>
            {:else}
                {@const price = upsell.specialPrice ?? upsell.course?.price ?? 0}
                <span class="text-3xl font-bold">{formatPrice(price)}</span>
            {/if}
        </div>
        <Button size="lg" class="w-full max-w-md h-14 text-lg" onclick={accept} disabled={isLoading}>
            {isLoading ? 'Verarbeitung...' : 'Ja, ich möchte das haben!'}
            {#if !isLoading}<ArrowRight class="w-5 h-5 ml-2" />{/if}
        </Button>
        <div>
            <button
                onclick={decline}
                disabled={isDeclining}
                class="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
                Nein danke, ich verzichte auf dieses Angebot
            </button>
        </div>
    </div>
{:else}
    <!-- Fallback if no blocks configured -->
    <div class="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <div class="max-w-2xl w-full space-y-8">
            <div class="text-center space-y-3">
                <p class="text-xs uppercase tracking-[0.2em] text-primary font-bold">Special One-Time Offer</p>
                <h1 class="text-3xl md:text-4xl font-serif font-bold">
                    {upsell.course?.title}
                </h1>
            </div>

            <div class="border rounded-xl overflow-hidden">
                {#if upsell.course?.thumbnailUrl}
                    <img src={upsell.course.thumbnailUrl} alt={upsell.course.title} class="w-full h-48 object-cover" />
                {/if}
                <div class="p-6 space-y-4">
                    <h2 class="text-xl font-semibold">{upsell.course?.title}</h2>
                    <div class="flex items-baseline gap-3 pt-2">
                        {#if upsell.specialPrice != null && upsell.course && upsell.specialPrice < upsell.course.price}
                            <span class="text-3xl font-bold text-primary">{formatPrice(upsell.specialPrice)}</span>
                            <span class="text-lg text-muted-foreground line-through">{formatPrice(upsell.course.price)}</span>
                        {:else}
                            {@const price = upsell.specialPrice ?? upsell.course?.price ?? 0}
                            <span class="text-3xl font-bold">{formatPrice(price)}</span>
                        {/if}
                    </div>
                </div>
            </div>

            <div class="space-y-3 text-center">
                <Button size="lg" class="w-full h-14 text-lg" onclick={accept} disabled={isLoading}>
                    {isLoading ? 'Verarbeitung...' : 'Ja, ich möchte das haben!'}
                    {#if !isLoading}<ArrowRight class="w-5 h-5 ml-2" />{/if}
                </Button>
                <button
                    onclick={decline}
                    disabled={isDeclining}
                    class="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                    Nein danke, ich verzichte auf dieses Angebot
                </button>
            </div>
        </div>
    </div>
{/if}
