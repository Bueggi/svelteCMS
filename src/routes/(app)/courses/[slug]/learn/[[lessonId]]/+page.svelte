<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { ChevronLeft, ChevronRight, CheckCircle, PlayCircle, FileText } from "lucide-svelte";
    import { fade } from 'svelte/transition';

    let { data } = $props();
    // derived activeLesson so it updates when data changes
    let activeLesson = $derived(data.activeLesson);
    let nextLessonId = $derived(data.nextLessonId);
    let prevLessonId = $derived(data.prevLessonId);
    let course = $derived(data.course);
    let moduleRatingData = $derived(data.moduleRatingData);

    let isCompleting = $state(false);

    import LessonView from '$lib/components/course-player/LessonView.svelte';
</script>

<svelte:head>
    <title>{activeLesson?.title || 'Course Player'} | {course.title}</title>
</svelte:head>

<LessonView
    activeLesson={activeLesson}
    course={course}
    nextLessonId={nextLessonId}
    prevLessonId={prevLessonId}
    isCompleting={isCompleting}
    onComplete={(val: boolean) => isCompleting = val}
    moduleRatingData={moduleRatingData}
/>
