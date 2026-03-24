<script lang="ts">
    import { fade } from "svelte/transition";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { PlayCircle, FileText, Clock, Lock, Star } from "lucide-svelte";
    import { DEFAULT_COURSE_IMAGE } from "$lib/constants";
    import { enhance } from '$app/forms';
    import PageBlocks from '$lib/blocks/PageBlocks.svelte';
    import type { Block } from '$lib/blocks/types';

    let { data } = $props();
    let course = $derived(data.course);
    let user = $derived(data.user);
    let courseReviews = $derived(data.courseReviews);
    let avgRating = $derived(data.avgRating);
    let totalReviews = $derived(data.totalReviews);
    let isEnrolled = $derived(data.isEnrolled);
    let userReview = $derived(data.userReview);

    let newRating = $state(userReview?.rating ?? 0);
    let hoverRating = $state(0);

    function starLabel(n: number) { return ['', '★', '★★', '★★★', '★★★★', '★★★★★'][n] ?? ''; }

    function handleEnroll() {
        if (course.checkoutMode === 'embedded') {
            document.getElementById('checkout-block')?.scrollIntoView({ behavior: 'smooth' });
        } else {
            window.location.href = `/checkout/${course.slug}`;
        }
    }
</script>

<svelte:head>
    <title>{course.title} | Lumière Academy</title>
</svelte:head>

<div class="min-h-screen bg-background pb-20">
    {#if course.landingPageData && course.landingPageStatus === 'public'}
        {@const landingBlocks = JSON.parse(course.landingPageData) as Block[]}
        <PageBlocks blocks={landingBlocks} courseSlug={course.slug} coursePrice={course.price} courseTitle={course.title} courseThumbnailUrl={course.thumbnailUrl ?? undefined} courseId={course.id} courseUpsells={data.courseUpsells} checkoutMode={course.checkoutMode} enabledMethods={data.enabledMethods} paypalClientId={data.paypalClientId} vatRate={data.vatRate} reverseChargeEnabled={data.reverseChargeEnabled} operatorCountry={data.operatorCountry} taxRates={data.taxRates} />
    {:else}
    <!-- Default Hero Section -->
    <div class="relative h-[60vh] min-h-[500px] w-full overflow-hidden">
         <img src={course.thumbnailUrl || DEFAULT_COURSE_IMAGE} alt={course.title} class="absolute inset-0 w-full h-full object-cover" />
         <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px]"></div>
         <div class="absolute inset-0 flex flex-col justify-end p-8 md:p-16 container mx-auto">
             <div in:fade={{ duration: 800, delay: 200 }} class="max-w-4xl space-y-6">
                 <Badge variant="outline" class="border-white/30 text-white bg-white/10 backdrop-blur-md uppercase tracking-widest">Course</Badge>
                 <h1 class="text-5xl md:text-7xl font-serif text-white leading-tight">{course.title}</h1>
                 <p class="text-xl md:text-2xl text-white/90 font-light max-w-2xl">{course.subtitle}</p>
                 <div class="flex items-center gap-4 pt-4">
                     <Button size="lg" variant="luxury" class="min-w-[200px]" onclick={handleEnroll}>
                        {course.price === 0 ? 'Start Learning' : 'Get Access'}
                     </Button>
                 </div>
             </div>
         </div>
    </div>

    <div class="container mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <!-- Main Content -->
        <div class="lg:col-span-2 space-y-12">
            <!-- About -->
            <section class="space-y-6">
                <h2 class="text-3xl font-serif border-l-4 border-primary pl-4">About This Course</h2>
                <div class="prose prose-lg prose-neutral dark:prose-invert max-w-none">
                     {#if course.fullDescription}
                         {@html course.fullDescription}
                     {:else}
                         <p>{course.description}</p>
                     {/if}
                </div>
            </section>

            <!-- Modules -->
            <section class="space-y-8">
                <h2 class="text-3xl font-serif border-l-4 border-primary pl-4">Curriculum</h2>
                {#each course.modules as module (module.id)}
                    <div class="group border rounded-lg overflow-hidden bg-card/50 shadow-sm hover:shadow-md transition-shadow">
                        <div class="p-6 bg-muted/40 border-b flex justify-between items-center group-hover:bg-muted/60 transition-colors">
                            <div>
                                <h3 class="text-xl font-medium font-serif">{module.title}</h3>
                                {#if module.description}
                                    <p class="text-sm text-muted-foreground mt-1">{module.description}</p>
                                {/if}
                            </div>
                            <span class="text-xs font-mono text-muted-foreground uppercase tracking-wider">{module.lessons.length} Lessons</span>
                        </div>
                        <div class="divide-y divide-border/50">
                            {#each module.lessons as lesson (lesson.id)}
                                <a href={`/courses/${course.slug}/learn/${lesson.id}`} class="block p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors cursor-pointer group/lesson">
                                    <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover/lesson:bg-primary group-hover/lesson:text-primary-foreground transition-colors ml-2">
                                        {#if lesson.type === 'video'}
                                            <PlayCircle class="w-4 h-4" />
                                        {:else}
                                            <FileText class="w-4 h-4" />
                                        {/if}
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="font-medium group-hover/lesson:text-primary transition-colors">{lesson.title}</h4>
                                        <div class="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            {#if lesson.duration}
                                                <span class="flex items-center gap-1"><Clock class="w-3 h-3" /> {lesson.duration}m</span>
                                            {/if}
                                            {#if lesson.isFreePreview}
                                                <Badge variant="outline" class="text-[9px] h-5 px-1.5 border-green-500/30 text-green-600 bg-green-50 dark:bg-green-900/10 font-bold uppercase tracking-widest">Free Preview</Badge>
                                            {/if}
                                        </div>
                                    </div>
                                    {#if !lesson.isFreePreview}
                                        <Lock class="w-4 h-4 text-muted-foreground/30 mr-2" />
                                    {/if}
                                </a>
                            {/each}
                        </div>
                    </div>
                {/each}
            </section>
        </div>

        <!-- Sidebar -->
        <div class="space-y-8">
            <Card class="sticky top-24 border-none shadow-luxury bg-background/50 backdrop-blur-xl">
                <CardHeader>
                    <CardTitle class="font-serif text-2xl">Instructor</CardTitle>
                </CardHeader>
                <CardContent class="space-y-6">
                     <div class="flex items-center gap-4">
                         <div class="w-16 h-16 rounded-full bg-muted overflow-hidden ring-2 ring-background shadow-lg">
                             {#if course.instructor?.image}
                                 <img src={course.instructor.image} alt={course.instructor.name} class="w-full h-full object-cover" />
                             {:else}
                                 <div class="w-full h-full bg-gold/20 flex items-center justify-center text-gold text-xl font-serif">
                                     {course.instructor?.name?.charAt(0)}
                                 </div>
                             {/if}
                         </div>
                         <div>
                             <p class="font-medium text-lg">{course.instructor?.name}</p>
                             <p class="text-sm text-muted-foreground capitalize">{course.instructor?.role}</p>
                         </div>
                     </div>
                     <hr class="border-border" />
                     <div class="text-sm text-muted-foreground space-y-3">
                         <div class="flex justify-between items-center">
                             <span>Course Level</span>
                             <span class="font-medium text-foreground">Beginner</span>
                         </div>
                         <div class="flex justify-between items-center">
                             <span>Access</span>
                             <span class="font-medium text-foreground">Lifetime</span>
                         </div>
                         <div class="flex justify-between items-center">
                             <span>Certificate</span>
                             <span class="font-medium text-foreground">Yes</span>
                         </div>
                     </div>
                     <Button class="w-full mt-4 bg-gold hover:bg-gold/90 text-white font-bold tracking-widest" size="lg" onclick={handleEnroll}>
                        ENROLL NOW {course.price > 0 ? `• ${(course.price / 100).toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}` : '(Free)'}
                     </Button>
                </CardContent>
            </Card>
        </div>
    </div>
    {/if}

    <!-- Reviews Section -->
    <div class="max-w-4xl mx-auto px-4 py-16 space-y-10">

        <!-- Aggregate rating -->
        {#if totalReviews > 0}
            <div class="flex items-center gap-6">
                <div class="text-center">
                    <div class="text-5xl font-bold">{avgRating?.toFixed(1)}</div>
                    <div class="flex justify-center gap-0.5 my-1">
                        {#each [1,2,3,4,5] as n}
                            <Star class="w-5 h-5 {n <= Math.round(avgRating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}" />
                        {/each}
                    </div>
                    <div class="text-sm text-muted-foreground">{totalReviews} {totalReviews === 1 ? 'Review' : 'Reviews'}</div>
                </div>
            </div>
        {/if}

        <!-- Write a review (enrolled users only) -->
        {#if isEnrolled}
            <div class="bg-card border rounded-xl p-6 space-y-4">
                <h3 class="font-semibold text-lg">{userReview ? 'Deine Bewertung bearbeiten' : 'Bewertung schreiben'}</h3>
                <form method="POST" action="?/submitReview" use:enhance class="space-y-4">
                    <div>
                        <div class="flex gap-1">
                            {#each [1,2,3,4,5] as n}
                                <button
                                    type="button"
                                    onmouseenter={() => hoverRating = n}
                                    onmouseleave={() => hoverRating = 0}
                                    onclick={() => newRating = n}
                                    class="text-3xl transition-transform hover:scale-110"
                                >
                                    <Star class="w-8 h-8 {n <= (hoverRating || newRating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}" />
                                </button>
                            {/each}
                        </div>
                        <input type="hidden" name="rating" value={newRating} />
                    </div>
                    <textarea
                        name="body"
                        rows="3"
                        placeholder="Was hat dir besonders gefallen? (optional)"
                        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    >{userReview?.body ?? ''}</textarea>
                    <Button type="submit" disabled={newRating === 0}>
                        {userReview ? 'Bewertung aktualisieren' : 'Bewertung abschicken'}
                    </Button>
                </form>
            </div>
        {/if}

        <!-- Review list -->
        {#if courseReviews.length > 0}
            <div class="space-y-6">
                <h2 class="text-2xl font-serif font-bold">Bewertungen</h2>
                {#each courseReviews as review}
                    <div class="flex gap-4 border-b pb-6 last:border-0">
                        <div class="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center font-semibold text-sm">
                            {review.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex-1 space-y-1">
                            <div class="flex items-center justify-between">
                                <span class="font-medium text-sm">{review.user.name}</span>
                                <span class="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString('de-DE')}</span>
                            </div>
                            <div class="flex gap-0.5">
                                {#each [1,2,3,4,5] as n}
                                    <Star class="w-4 h-4 {n <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />
                                {/each}
                            </div>
                            {#if review.body}
                                <p class="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    :global(h1, h2, h3, h4) {
        text-wrap: balance;
    }
</style>
