<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { quintOut } from "svelte/easing";
    import { Button } from "$lib/components/ui/button";
    import { Star, Clock, User, ArrowUpRight, Shield } from "@lucide/svelte";
    import { DEFAULT_COURSE_IMAGE } from "$lib/constants";

    let { data } = $props();
    const courses = $derived(data.courses);
</script>

<svelte:head>
    <title>Academy | LUMIÈRE Mastery</title>
</svelte:head>

<div class="min-h-screen bg-background">
    <!-- Minimal top bar -->
    <div class="border-b border-border/30 px-8 py-5 flex items-center justify-between">
        <a href="/courses" class="flex items-center gap-3 group">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-foreground font-bold shadow-sm">
                <Shield class="w-4 h-4" />
            </div>
            <span class="font-serif font-bold tracking-wider text-lg">LUMIÈRE</span>
        </a>
        <a href="/login" class="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors">
            Sign In
        </a>
    </div>

    <div class="container mx-auto px-6 py-20 space-y-16">
        <!-- Header -->
        <header class="max-w-3xl space-y-5" in:fade={{ duration: 800 }}>
            <span class="text-[10px] uppercase tracking-[0.4em] font-bold text-primary">LUMIÈRE ACADEMY</span>
            <h1 class="text-5xl md:text-6xl font-serif font-medium leading-[1.1]">
                Unlock the Art of <span class="italic text-primary">Clinical Radiance</span>
            </h1>
            <p class="text-lg text-muted-foreground leading-relaxed">
                Curated mastery courses designed for those who seek uncompromising quality and scientific depth.
            </p>
        </header>

        <!-- Course Grid -->
        {#if courses.length === 0}
            <div class="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
                <p class="font-serif text-xl">No courses available yet.</p>
                <a href="/login" class="text-sm underline underline-offset-4 hover:text-foreground transition-colors">Sign in to your account</a>
            </div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {#each courses as course, i}
                    <div in:fly={{ y: 24, duration: 700, delay: 80 * i, easing: quintOut }}>
                        <div class="group flex flex-col h-full rounded-2xl overflow-hidden border border-border/50 bg-card transition-all duration-500 hover:shadow-xl hover:-translate-y-1">
                            <!-- Thumbnail -->
                            <div class="relative aspect-video overflow-hidden bg-muted">
                                <img
                                    src={course.thumbnailUrl || DEFAULT_COURSE_IMAGE}
                                    alt={course.title}
                                    class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    loading="lazy"
                                />
                                <div class="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-500"></div>
                                <div class="absolute top-3 left-3">
                                    <div class="px-3 py-1 bg-background/85 backdrop-blur-md rounded-full text-[9px] uppercase tracking-widest font-bold border border-white/10">
                                        {course.price > 0 ? `$${(course.price / 100).toFixed(2)}` : 'Free'}
                                    </div>
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="flex flex-col flex-1 p-7">
                                <div class="flex items-center gap-1.5 mb-3">
                                    {#each Array(5) as _}
                                        <Star class="w-3 h-3 fill-primary text-primary" />
                                    {/each}
                                    <span class="text-[10px] text-muted-foreground uppercase tracking-widest ml-1">Mastery Series</span>
                                </div>
                                <h2 class="text-xl font-serif font-medium leading-snug mb-3 group-hover:text-primary transition-colors line-clamp-2">
                                    {course.title}
                                </h2>
                                {#if course.subtitle || course.description}
                                    <p class="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1">
                                        {course.subtitle || course.description}
                                    </p>
                                {/if}

                                <div class="flex items-center gap-5 text-muted-foreground mt-5 mb-6">
                                    {#if course.instructor}
                                        <div class="flex items-center gap-1.5">
                                            <User class="w-3.5 h-3.5" />
                                            <span class="text-xs">{course.instructor.name}</span>
                                        </div>
                                    {/if}
                                </div>

                                <Button href={`/courses/${course.slug}`} class="w-full gap-2">
                                    Enter Course
                                    <ArrowUpRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
