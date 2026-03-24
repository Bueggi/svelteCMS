<script lang="ts">
    import PageBlocks from '$lib/blocks/PageBlocks.svelte';
    import { Button } from '$lib/components/ui/button';
    import { CheckCircle2, BookOpen } from 'lucide-svelte';

    let { data } = $props();
</script>

<svelte:head>
    <title>Danke! — {data.funnel.name}</title>
    {#if data.funnel.trackingPixels}{@html data.funnel.trackingPixels}{/if}
</svelte:head>

{#if data.blocks.length > 0}
    <PageBlocks
        blocks={data.blocks}
        courseSlug={data.funnel.course?.slug}
        courseTitle={data.funnel.course?.title}
        courseThumbnailUrl={data.funnel.course?.thumbnailUrl ?? undefined}
        courseId={data.funnel.course?.id}
        purchaseAmount={data.purchase?.amount}
    />
{:else}
    <div class="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <div class="max-w-2xl w-full text-center space-y-8">
            <div class="flex justify-center">
                <div class="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 class="w-12 h-12 text-green-600" />
                </div>
            </div>
            <div class="space-y-4">
                <h1 class="text-4xl font-serif font-bold">Vielen Dank!</h1>
                <p class="text-xl text-muted-foreground">Deine Bestellung ist bestätigt. Du hast jetzt sofortigen Zugang.</p>
            </div>
            <Button href="/my-courses" size="lg" class="h-14 px-10">
                <BookOpen class="w-5 h-5 mr-2" /> Zu meinen Kursen
            </Button>
        </div>
    </div>
{/if}
