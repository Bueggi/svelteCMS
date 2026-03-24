<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { CheckCircle2, ArrowRight, BookOpen, Zap } from 'lucide-svelte';

    let { data } = $props();
    let course = $derived(data.course);
    let nextUpsell = $derived(data.nextUpsell);
    let customerName = $derived(data.customerName);

    function formatPrice(cents: number) {
        return (cents / 100).toFixed(2).replace('.', ',');
    }

    function getUpsellPrice(upsell: any) {
        const base = upsell.upsellCourse.price;
        if (upsell.discountPercent > 0) {
            return Math.round(base * (1 - upsell.discountPercent / 100));
        }
        return base;
    }

    let isLoadingUpsell = $state(false);

    async function handleUpsellCheckout() {
        if (!nextUpsell) return;
        isLoadingUpsell = true;

        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId: nextUpsell.upsellCourse.id,
                })
            });

            const result = await response.json();
            if (result.url) {
                window.location.href = result.url;
            }
        } catch (e) {
            isLoadingUpsell = false;
        }
    }
</script>

<div class="min-h-screen bg-background flex items-center justify-center px-4 py-16">
    <div class="max-w-2xl w-full space-y-8">
        <!-- Success Banner -->
        <div class="text-center space-y-4">
            <div class="flex justify-center">
                <div class="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 class="w-10 h-10 text-green-600" />
                </div>
            </div>
            <div>
                <h1 class="text-3xl font-serif font-bold tracking-tight">
                    {customerName ? `Thank you, ${customerName.split(' ')[0]}!` : 'Thank you!'}
                </h1>
                <p class="text-muted-foreground mt-2 text-lg">
                    Your purchase of <span class="font-medium text-foreground">{course.title}</span> is confirmed.
                </p>
            </div>
        </div>

        <!-- Course Access Card -->
        <div class="bg-card border rounded-xl p-6 flex items-center gap-4">
            {#if course.thumbnailUrl}
                <img src={course.thumbnailUrl} alt={course.title} class="w-16 h-12 object-cover rounded-lg flex-shrink-0" />
            {:else}
                <div class="w-16 h-12 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                    <BookOpen class="w-6 h-6 text-muted-foreground" />
                </div>
            {/if}
            <div class="flex-1 min-w-0">
                <h2 class="font-semibold truncate">{course.title}</h2>
                <p class="text-sm text-muted-foreground">Lifetime access granted</p>
            </div>
            <Button href="/courses/{course.slug}/learn" variant="default">
                Start Learning <ArrowRight class="w-4 h-4 ml-2" />
            </Button>
        </div>

        <!-- Upsell Offer (if any) -->
        {#if nextUpsell}
            {@const upsellPrice = getUpsellPrice(nextUpsell)}
            <div class="bg-card border-2 border-primary/30 rounded-xl p-6 space-y-4 relative overflow-hidden">
                <div class="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                    Special Offer
                </div>
                <div class="flex items-start gap-3">
                    <div class="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                        <Zap class="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 class="font-semibold text-lg">
                            {nextUpsell.label || `Upgrade with ${nextUpsell.upsellCourse.title}`}
                        </h3>
                        <p class="text-sm text-muted-foreground mt-1">
                            {nextUpsell.upsellCourse.subtitle || 'Take your skills to the next level with this exclusive add-on.'}
                        </p>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-2 border-t">
                    <div>
                        {#if nextUpsell.discountPercent > 0}
                            <div class="flex items-baseline gap-2">
                                <span class="text-2xl font-bold">€{formatPrice(upsellPrice)}</span>
                                <span class="text-sm text-muted-foreground line-through">€{formatPrice(nextUpsell.upsellCourse.price)}</span>
                                <Badge class="bg-green-500/10 text-green-700 border-green-200">
                                    Save {nextUpsell.discountPercent}%
                                </Badge>
                            </div>
                        {:else}
                            <span class="text-2xl font-bold">€{formatPrice(upsellPrice)}</span>
                        {/if}
                        <p class="text-xs text-muted-foreground">One-time payment • Lifetime access</p>
                    </div>
                    <Button onclick={handleUpsellCheckout} disabled={isLoadingUpsell} size="lg">
                        {isLoadingUpsell ? 'Loading...' : 'Add to My Courses'}
                        {#if !isLoadingUpsell}
                            <ArrowRight class="w-4 h-4 ml-2" />
                        {/if}
                    </Button>
                </div>
            </div>

            <p class="text-center text-sm text-muted-foreground">
                No thanks, I'll skip this offer.
                <a href="/courses/{course.slug}/learn" class="text-primary underline">Go to my course →</a>
            </p>
        {:else}
            <div class="text-center">
                <Button href="/courses/{course.slug}/learn" size="lg">
                    <BookOpen class="w-4 h-4 mr-2" /> Go to My Course
                </Button>
            </div>
        {/if}
    </div>
</div>
