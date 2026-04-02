<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from "$lib/components/ui/button";
    import { PlayCircle, CheckCircle, Circle, ChevronLeft, Lock, Clock } from "lucide-svelte";
    import { cn } from "$lib/utils";
    import { getContext } from "svelte";
    import { getT, type LangKey } from "$lib/i18n";

    let {
        course,
        completedLessonIds = new Set(),
        unlockedLessonIds = null as Set<string> | null,
        activeLessonId,
        daysSinceEnrollment = 0,
        preview = false
    } = $props();

    let baseUrl = $derived(preview ? `/admin/preview/courses/${course.slug}/learn` : `/courses/${course.slug}/learn`);
    let backUrl = $derived(preview ? `/admin/courses/${course.id}` : `/dashboard`);

    const langCtx = getContext<{ lang: LangKey } | undefined>('i18n');
    const t = $derived(getT(langCtx?.lang ?? 'de'));

    const totalLessons = $derived(course.modules.reduce((acc: number, m: any) => acc + m.lessons.length, 0));
    const progressPct = $derived(totalLessons > 0 ? Math.round((completedLessonIds.size / totalLessons) * 100) : 0);
</script>

<aside class="hidden md:flex w-80 flex-col border-r bg-muted/40 backdrop-blur-xl transition-colors duration-500">
    <div class="p-4 border-b flex items-center gap-2">
        <a href={backUrl} class="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft class="w-5 h-5" />
        </a>
        <h2 class="font-serif font-medium truncate" title={course.title}>{course.title}</h2>
    </div>

    <div class="p-4 space-y-6">
        {#each course.modules as module (module.id)}
            <div class="space-y-2">
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
                    {module.title}
                </h3>
                <div class="space-y-1">
                    {#each module.lessons as lesson (lesson.id)}
                        {@const isActive = activeLessonId === lesson.id}
                        {@const isCompleted = completedLessonIds.has(lesson.id)}
                        {@const isLocked = unlockedLessonIds !== null && !unlockedLessonIds.has(lesson.id)}
                        {@const daysLeft = isLocked && lesson.dripDays != null ? lesson.dripDays - daysSinceEnrollment : null}

                        <a
                            href={isLocked ? undefined : `${baseUrl}/${lesson.id}`}
                            aria-disabled={isLocked}
                            class={cn(
                                "flex items-start gap-3 px-3 py-2 text-sm rounded-md transition-all duration-200 group relative overflow-hidden",
                                isLocked
                                    ? "cursor-not-allowed text-muted-foreground/60"
                                    : isActive
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div class={cn(
                                "absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none",
                                isActive ? "bg-linear-to-r from-primary/5 to-transparent opacity-100" : ""
                            )}></div>

                            <div class="relative z-10 shrink-0 mt-0.5">
                                {#if isLocked}
                                    <Lock class="w-4 h-4 text-muted-foreground/40" />
                                {:else if isCompleted}
                                    <CheckCircle class="w-4 h-4 text-green-500" />
                                {:else if isActive}
                                    <PlayCircle class="w-4 h-4 text-primary animate-pulse" />
                                {:else}
                                    <Circle class="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                                {/if}
                            </div>

                            <div class="relative z-10 flex-1 min-w-0">
                                <span class="line-clamp-2 leading-tight">{lesson.title}</span>
                                {#if isLocked && daysLeft != null}
                                    <span class="inline-flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
                                        <Clock class="w-2.5 h-2.5" />
                                        {daysLeft <= 0 ? t('playerSoon') : daysLeft === 1 ? `${t('next')} ${t('playerDay')}` : `${daysLeft} ${t('playerDays')}`}
                                    </span>
                                {/if}
                            </div>
                        </a>
                    {/each}
                </div>
            </div>
        {/each}
    </div>

    {#if !preview}
        <div class="p-4 border-t bg-card/50">
           <div class="text-xs text-center text-muted-foreground">
               {progressPct}{t('playerProgressLabel')}
           </div>
           <div class="h-1 w-full bg-secondary/20 mt-2 rounded-full overflow-hidden">
               <div class="h-full bg-primary transition-all duration-500" style={`width: ${progressPct}%`}></div>
           </div>
        </div>
    {:else}
        <div class="p-4 border-t bg-luxury/5 border-luxury/10">
            <div class="text-[10px] text-center text-luxury uppercase tracking-widest font-bold">
                {t('playerInstructorPreview')}
            </div>
        </div>
    {/if}
</aside>
