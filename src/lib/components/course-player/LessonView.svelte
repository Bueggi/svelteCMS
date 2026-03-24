<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { ChevronLeft, ChevronRight, CheckCircle, Lock, Star } from "lucide-svelte";

    let {
        activeLesson,
        course,
        nextLessonId,
        prevLessonId,
        isCompleting = false,
        onComplete = null,
        moduleRatingData = null,
        preview = false
    } = $props();

    let baseUrl = $derived(preview ? `/admin/preview/courses/${course.slug}/learn` : `/courses/${course.slug}/learn`);

    function toEmbedUrl(url: string): string {
        if (!url) return url;
        // Already an embed URL
        if (url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/')) return url;
        // youtu.be shortlink
        const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
        if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
        // youtube.com/watch?v=
        const watchMatch = url.match(/youtube\.com\/watch\?(?:.*&)?v=([^&]+)/);
        if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
        // vimeo.com/ID
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        return url;
    }

    // Rating widget state — initialised from server data, updates optimistically
    let currentRating = $state<number>(moduleRatingData?.rating ?? 0);
    let hoverRating = $state(0);
    let ratingSubmitted = $state(moduleRatingData?.rating != null);

    // Keep in sync when navigating between lessons (moduleRatingData changes)
    $effect(() => {
        currentRating = moduleRatingData?.rating ?? 0;
        hoverRating = 0;
        ratingSubmitted = moduleRatingData?.rating != null;
    });
</script>

<div class="space-y-8 animate-in fade-in duration-500">
    {#if activeLesson}
        <div class="space-y-4">
            <h1 class="text-3xl font-serif font-medium leading-tight">{activeLesson.title}</h1>

            {#if activeLesson.isLocked}
                <div class="aspect-video w-full bg-muted rounded-lg overflow-hidden shadow-2xl flex items-center justify-center">
                    <div class="text-center p-8 max-w-md">
                        <div class="w-16 h-16 rounded-full bg-muted-foreground/10 flex items-center justify-center mx-auto mb-4">
                            <Lock class="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h2 class="text-xl font-serif font-semibold mb-2">Lektion noch gesperrt</h2>
                        {#if activeLesson.unlockDaysLeft != null}
                            <p class="text-muted-foreground">
                                Diese Lektion wird in <strong>{activeLesson.unlockDaysLeft} {activeLesson.unlockDaysLeft === 1 ? 'Tag' : 'Tagen'}</strong> freigeschaltet.
                            </p>
                        {:else}
                            <p class="text-muted-foreground">Diese Lektion ist noch nicht verfügbar.</p>
                        {/if}
                    </div>
                </div>
            {:else}

            {#if activeLesson.videoUrl}
            <div class="aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-2xl">
                <iframe
                    src={toEmbedUrl(activeLesson.videoUrl)}
                    title={activeLesson.title}
                    class="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                ></iframe>
            </div>
            {/if}

            <div class="lesson-prose prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none">
                {@html activeLesson.content}
            </div>

            {/if}<!-- end drip lock check -->

            <!-- Module rating widget -->
            {#if !preview && !activeLesson.isLocked && moduleRatingData}
                <div class="border border-border/50 rounded-2xl p-5 bg-muted/20 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modul bewerten</p>
                            <p class="text-sm font-medium text-foreground mt-0.5">{moduleRatingData.moduleName}</p>
                        </div>
                        {#if ratingSubmitted}
                            <span class="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                                Bewertet ✓
                            </span>
                        {/if}
                    </div>

                    <form method="POST" action="?/rateModule" use:enhance={({ formData }) => {
                        const r = parseInt(formData.get('rating') as string);
                        currentRating = r;
                        ratingSubmitted = true;
                        return async ({ update }) => update({ reset: false });
                    }}>
                        <input type="hidden" name="moduleId" value={moduleRatingData.moduleId} />
                        <input type="hidden" name="rating" value={currentRating} />

                        <div class="flex items-center gap-1">
                            {#each [1, 2, 3, 4, 5] as n}
                                <button
                                    type="submit"
                                    onmouseenter={() => hoverRating = n}
                                    onmouseleave={() => hoverRating = 0}
                                    onclick={() => currentRating = n}
                                    class="transition-transform hover:scale-110 focus:outline-none"
                                    aria-label="{n} Stern{n !== 1 ? 'e' : ''}"
                                >
                                    <Star
                                        class="w-7 h-7 transition-colors {n <= (hoverRating || currentRating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/25'}"
                                    />
                                </button>
                            {/each}
                            {#if currentRating > 0}
                                <span class="ml-2 text-sm text-muted-foreground">
                                    {['', 'Schwach', 'Ausbaufähig', 'Gut', 'Sehr gut', 'Ausgezeichnet'][currentRating]}
                                </span>
                            {/if}
                        </div>
                    </form>
                </div>
            {/if}

            <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t">
                <div class="flex gap-2 w-full sm:w-auto">
                    {#if prevLessonId}
                        <Button variant="outline" href={`${baseUrl}/${prevLessonId}`} class="flex-1 sm:flex-none">
                            <ChevronLeft class="w-4 h-4 mr-2" /> Previous
                        </Button>
                    {:else}
                        <Button variant="outline" disabled class="flex-1 sm:flex-none">
                            <ChevronLeft class="w-4 h-4 mr-2" /> Previous
                        </Button>
                    {/if}
                </div>

                {#if !preview}
                    <form method="POST" action="?/complete" use:enhance={() => {
                        if (onComplete) onComplete(true);
                        return async ({ update }) => {
                            await update();
                            if (onComplete) onComplete(false);
                        }
                    }} class="w-full sm:w-auto">
                        <input type="hidden" name="lessonId" value={activeLesson.id} />
                        <Button type="submit" size="lg" class="w-full sm:min-w-[200px] bg-primary hover:bg-primary/90" disabled={isCompleting}>
                            {#if isCompleting}
                                Saving...
                            {:else}
                                <CheckCircle class="w-4 h-4 mr-2" /> Mark as Complete
                            {/if}
                        </Button>
                    </form>
                {:else}
                    <div class="px-6 py-2 bg-luxury/10 border border-luxury/20 rounded-full text-luxury text-sm font-medium animate-pulse">
                        Instructor Preview Mode
                    </div>
                {/if}

                <div class="flex gap-2 w-full sm:w-auto">
                     {#if nextLessonId}
                        <Button variant="outline" href={`${baseUrl}/${nextLessonId}`} class="flex-1 sm:flex-none">
                            Next <ChevronRight class="w-4 h-4 ml-2" />
                        </Button>
                    {:else}
                        <Button variant="outline" disabled class="flex-1 sm:flex-none">
                            Next <ChevronRight class="w-4 h-4 ml-2" />
                        </Button>
                    {/if}
                </div>
            </div>
        </div>
    {:else}
        <div class="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
            <div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Star class="w-8 h-8 text-muted-foreground" />
            </div>
            <p class="text-muted-foreground font-serif text-lg">Select a lesson to start learning.</p>
        </div>
    {/if}
</div>

<style>
    /* Force prose to use theme CSS variables instead of Tailwind's hardcoded gray palette.
       Needed because this app uses CSS-variable-based theming (no .dark class on body). */
    .lesson-prose :global(p),
    .lesson-prose :global(li),
    .lesson-prose :global(td),
    .lesson-prose :global(th) {
        color: hsl(var(--foreground));
    }
    .lesson-prose :global(h1),
    .lesson-prose :global(h2),
    .lesson-prose :global(h3),
    .lesson-prose :global(h4),
    .lesson-prose :global(h5),
    .lesson-prose :global(h6) {
        color: hsl(var(--foreground));
    }
    .lesson-prose :global(strong) {
        color: hsl(var(--foreground));
    }
    .lesson-prose :global(a) {
        color: hsl(var(--primary));
    }
    .lesson-prose :global(blockquote) {
        color: hsl(var(--muted-foreground));
        border-left-color: hsl(var(--border));
    }
    .lesson-prose :global(code) {
        color: hsl(var(--foreground));
        background-color: hsl(var(--muted));
        border-radius: 0.25rem;
        padding: 0.1em 0.3em;
    }
    .lesson-prose :global(pre) {
        background-color: hsl(var(--muted));
        color: hsl(var(--foreground));
    }
    .lesson-prose :global(pre code) {
        background-color: transparent;
        padding: 0;
    }
    .lesson-prose :global(hr) {
        border-color: hsl(var(--border));
    }
    .lesson-prose :global(thead) {
        border-bottom-color: hsl(var(--border));
    }
    .lesson-prose :global(tbody tr) {
        border-bottom-color: hsl(var(--border) / 0.5);
    }
</style>
