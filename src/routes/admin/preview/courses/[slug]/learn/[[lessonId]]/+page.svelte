<script lang="ts">
    import LessonView from '$lib/components/course-player/LessonView.svelte';

    let { data } = $props();
    let activeLesson = $derived(data.activeLesson);
    let nextLessonId = $derived(data.nextLessonId);
    let prevLessonId = $derived(data.prevLessonId);
    let course = $derived(data.course);
</script>

<svelte:head>
    <title>[PREVIEW] {activeLesson?.title || 'Lesson'} | {course.title}</title>
</svelte:head>

<LessonView 
    activeLesson={activeLesson} 
    course={course} 
    nextLessonId={nextLessonId} 
    prevLessonId={prevLessonId} 
    preview={true}
/>
