<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from "$lib/components/ui/button";
    import { ChevronLeft, Menu } from "lucide-svelte";
    import CourseSidebar from '$lib/components/course-player/CourseSidebar.svelte';
    import { slide } from 'svelte/transition';

    let { data, children } = $props();
    let course = $derived(data.course);

    // Mobile menu state
    let isMenuOpen = $state(false);
    function toggleMenu() { isMenuOpen = !isMenuOpen; }

    // Determine active lesson from URL
    let activeLessonId = $derived($page.params.lessonId);
</script>

<div class="flex min-h-screen bg-background">
    <CourseSidebar 
        course={course} 
        activeLessonId={activeLessonId} 
        preview={true} 
    />

    <!-- Mobile Menu Overlay (SIMPLIFIED for preview) -->
    {#if isMenuOpen}
        <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden" transition:slide>
             <div class="fixed inset-y-0 left-0 w-3/4 bg-card border-r p-4 shadow-2xl">
                 <div class="flex justify-between items-center mb-6">
                     <h2 class="font-serif text-lg">{course.title}</h2>
                     <Button variant="ghost" size="icon" onclick={toggleMenu}>
                         <ChevronLeft class="w-5 h-5" />
                     </Button>
                 </div>
                 <p class="text-luxury text-sm font-bold uppercase tracking-widest">Preview Mode</p>
             </div>
        </div>
    {/if}

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 bg-background/50">
        <!-- Mobile Header -->
        <header class="md:hidden flex items-center p-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
            <Button variant="ghost" size="icon" onclick={toggleMenu} class="mr-2">
                <Menu class="w-5 h-5" />
            </Button>
            <span class="font-serif font-medium truncate">{course.title} (Preview)</span>
        </header>

        <div class="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
            {@render children()}
        </div>
    </main>
</div>
