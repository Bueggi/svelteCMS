<script lang="ts">
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { DEFAULT_COURSE_IMAGE } from "$lib/constants";
    import { CirclePlay, Award, BookOpen, CheckCircle2, ArrowRight } from "lucide-svelte";
    import { getContext } from "svelte";
    import { getT, type LangKey } from "$lib/i18n";

    let { data } = $props();
    let courses = $derived(data.enrolledCourses);

    const langCtx = getContext<{ lang: LangKey }>('i18n');
    const t = $derived(getT(langCtx.lang));
</script>

<PageContainer>
    <PageHeader title={t('myCoursesTitle')} description={t('myCoursesDesc')} />

    {#if courses.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each courses as course}
                {@const isCompleted = course.progress === 100}
                {@const isStarted = course.progress > 0}

                <a
                    href="/courses/{course.slug}/learn"
                    class="group bg-card rounded-2xl overflow-hidden flex flex-col border border-border/40 hover:border-primary/30 hover:shadow-2xl hover:shadow-black/8 transition-all duration-500"
                >
                    <!-- Thumbnail -->
                    <div class="relative aspect-video overflow-hidden shrink-0">
                        <img
                            src={course.thumbnailUrl || DEFAULT_COURSE_IMAGE}
                            alt={course.title}
                            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div class="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent"></div>

                        <!-- Play button on hover -->
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/50 flex items-center justify-center shadow-xl">
                                <CirclePlay class="w-7 h-7 text-white" />
                            </div>
                        </div>

                        <!-- Status badge -->
                        {#if isCompleted}
                            <div class="absolute top-3 left-3 flex items-center gap-1.5 bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow">
                                <CheckCircle2 class="w-3 h-3" /> {t('myCoursesCompleted')}
                            </div>
                        {:else}
                            <div class="absolute top-3 right-3 text-white text-xs font-bold tabular-nums bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
                                {course.progress}%
                            </div>
                        {/if}

                        <!-- Progress strip -->
                        <div class="absolute bottom-0 left-0 right-0 h-0.75 bg-white/10">
                            <div
                                class="h-full transition-all duration-500 {isCompleted ? 'bg-emerald-400' : 'bg-primary'}"
                                style="width: {course.progress}%"
                            ></div>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 p-5 flex flex-col gap-4">
                        <div class="flex-1 space-y-1.5">
                            <h3 class="font-serif font-semibold text-lg leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
                                {course.title}
                            </h3>
                            {#if course.subtitle}
                                <p class="text-sm text-muted-foreground line-clamp-1">{course.subtitle}</p>
                            {/if}
                        </div>

                        <!-- Progress info -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-xs text-muted-foreground">
                                <span class="flex items-center gap-1.5">
                                    <BookOpen class="w-3 h-3" />
                                    {course.completedLessons} / {course.totalLessons} {t('myCoursesLessons')}
                                </span>
                                <span class="font-semibold {isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}">
                                    {course.progress}%
                                </span>
                            </div>
                            <div class="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    class="h-full rounded-full transition-all duration-500 {isCompleted ? 'bg-emerald-500' : 'bg-linear-to-r from-primary to-primary/70'}"
                                    style="width: {course.progress}%"
                                ></div>
                            </div>
                        </div>

                        <!-- CTA -->
                        <div class="flex items-center justify-between pt-1 border-t border-border/40">
                            <span class="text-sm font-medium text-primary group-hover:underline underline-offset-2">
                                {isCompleted ? t('myCoursesReview') : isStarted ? t('myCoursesContinue') : t('myCoursesStart')}
                            </span>
                            <ArrowRight class="w-4 h-4 text-primary transition-transform duration-200 group-hover:translate-x-1" />
                        </div>
                    </div>
                </a>
            {/each}
        </div>
    {:else}
        <div class="flex flex-col items-center justify-center py-24 text-center">
            <div class="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center mb-6 ring-1 ring-primary/10">
                <Award class="w-9 h-9 text-primary/60" />
            </div>
            <h2 class="text-2xl font-serif font-semibold text-foreground mb-2">{t('myCoursesNone')}</h2>
            <p class="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                {t('myCoursesNoneDesc')}
            </p>
            <a
                href="/courses"
                class="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
            >
                {t('myCoursesDiscover')} <ArrowRight class="w-4 h-4" />
            </a>
        </div>
    {/if}
</PageContainer>
