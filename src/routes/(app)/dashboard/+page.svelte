<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Progress } from "$lib/components/ui/progress";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { DEFAULT_COURSE_IMAGE } from "$lib/constants";
    import { BookOpen, Award, LayoutGrid, Clock, ArrowRight, PlayCircle, ChevronRight, AlertTriangle } from "lucide-svelte";

    let { data } = $props();
    let user = $derived(data.user);
    let stats = $derived(data.stats);
    let resumeCourse = $derived(data.resumeCourse);
    let enrolledCourses = $derived(data.enrolledCourses);
    let expiringEnrollments = $derived(data.expiringEnrollments ?? []);

    function greeting() {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    }

    function formatDate() {
        return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
</script>

<PageContainer>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
            <p class="text-sm text-muted-foreground mb-1">{formatDate()}</p>
            <h1 class="text-3xl font-serif font-semibold text-foreground">
                {greeting()}, <span class="text-primary">{user?.name?.split(' ')[0] || 'there'}</span>
            </h1>
            <p class="text-muted-foreground mt-1">
                {#if stats.totalEnrolled === 0}
                    Start your learning journey today.
                {:else if stats.overallProgress === 100}
                    You've completed all your courses — well done!
                {:else}
                    Keep going — you're {stats.overallProgress}% through your learning.
                {/if}
            </p>
        </div>
        <Button href="/my-courses" class="shrink-0 gap-2">
            My Courses <ArrowRight class="w-4 h-4" />
        </Button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-card border border-border/60 rounded-2xl p-5 space-y-1">
            <div class="flex items-center justify-between">
                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Enrolled</p>
                <div class="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <LayoutGrid class="w-4 h-4 text-primary" />
                </div>
            </div>
            <p class="text-3xl font-bold text-foreground">{stats.totalEnrolled}</p>
            <p class="text-xs text-muted-foreground">{stats.completedCourses} completed</p>
        </div>

        <div class="bg-card border border-border/60 rounded-2xl p-5 space-y-1">
            <div class="flex items-center justify-between">
                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">In Progress</p>
                <div class="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <BookOpen class="w-4 h-4 text-amber-500" />
                </div>
            </div>
            <p class="text-3xl font-bold text-foreground">{stats.activeCourses}</p>
            <p class="text-xs text-muted-foreground">active course{stats.activeCourses !== 1 ? 's' : ''}</p>
        </div>

        <div class="bg-card border border-border/60 rounded-2xl p-5 space-y-1">
            <div class="flex items-center justify-between">
                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lessons Done</p>
                <div class="w-8 h-8 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Award class="w-4 h-4 text-green-600" />
                </div>
            </div>
            <p class="text-3xl font-bold text-foreground">{stats.completedLessons}</p>
            <p class="text-xs text-muted-foreground">of {stats.totalLessons} total</p>
        </div>

        <div class="bg-card border border-border/60 rounded-2xl p-5 space-y-1">
            <div class="flex items-center justify-between">
                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Progress</p>
                <div class="w-8 h-8 rounded-xl bg-secondary/20 flex items-center justify-center">
                    <Clock class="w-4 h-4 text-secondary" />
                </div>
            </div>
            <p class="text-3xl font-bold text-foreground">{stats.overallProgress}<span class="text-lg font-medium text-muted-foreground">%</span></p>
            <p class="text-xs text-muted-foreground">overall completion</p>
        </div>
    </div>

    <!-- Expiring warning -->
    {#if expiringEnrollments.length > 0}
        <div class="rounded-2xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/40 px-5 py-4">
            <div class="flex items-start gap-3">
                <AlertTriangle class="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div class="flex-1 min-w-0">
                    <p class="font-medium text-amber-900 dark:text-amber-100 text-sm">Access expiring soon</p>
                    <div class="mt-2 flex flex-wrap gap-2">
                        {#each expiringEnrollments as e}
                            <a href="/courses/{e.courseSlug}" class="inline-flex items-center gap-1.5 text-xs bg-background border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5 hover:border-amber-400 transition-colors">
                                <span class="font-medium text-foreground truncate max-w-[180px]">{e.courseTitle}</span>
                                <span class="text-amber-600 font-semibold shrink-0">{e.daysLeft}d left</span>
                            </a>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Resume / empty state -->
    {#if resumeCourse}
        <div>
            <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {resumeCourse.progress > 0 ? 'Continue where you left off' : 'Start your first course'}
            </h2>
            <a
                href="/courses/{resumeCourse.slug}/learn{resumeCourse.firstUnfinishedLesson ? `/${resumeCourse.firstUnfinishedLesson}` : ''}"
                class="group block bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
                <div class="flex flex-col sm:flex-row">
                    <!-- Thumbnail -->
                    <div class="relative sm:w-64 aspect-video sm:aspect-auto shrink-0 overflow-hidden bg-muted">
                        <img
                            src={resumeCourse.thumbnailUrl || DEFAULT_COURSE_IMAGE}
                            alt={resumeCourse.title}
                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur border border-white/50 flex items-center justify-center text-white">
                                <PlayCircle class="w-6 h-6 fill-current ml-0.5" />
                            </div>
                        </div>
                        {#if resumeCourse.progress > 0}
                            <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                                <div class="h-full bg-primary transition-all" style="width: {resumeCourse.progress}%"></div>
                            </div>
                        {/if}
                    </div>
                    <!-- Info -->
                    <div class="flex-1 p-6 flex flex-col justify-between gap-4">
                        <div>
                            <h3 class="text-xl font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">{resumeCourse.title}</h3>
                            {#if resumeCourse.subtitle}
                                <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{resumeCourse.subtitle}</p>
                            {/if}
                        </div>
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{resumeCourse.completedLessons} / {resumeCourse.totalLessons} lessons</span>
                                <span class="font-semibold text-foreground">{resumeCourse.progress}%</span>
                            </div>
                            <Progress value={resumeCourse.progress} class="h-1.5" />
                        </div>
                        <div class="flex items-center gap-2 text-sm font-medium text-primary group-hover:gap-3 transition-all">
                            {resumeCourse.progress > 0 ? 'Continue learning' : 'Start now'}
                            <ChevronRight class="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </a>
        </div>

    {:else if stats.totalEnrolled === 0}
        <div class="flex flex-col items-center justify-center py-20 text-center bg-card border border-dashed border-border rounded-2xl">
            <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen class="w-8 h-8 text-primary" />
            </div>
            <h2 class="text-xl font-semibold text-foreground mb-2">No courses yet</h2>
            <p class="text-muted-foreground max-w-sm mb-6 text-sm">
                Browse our catalog and enroll in your first course to get started.
            </p>
            <Button href="/courses">Browse Catalog</Button>
        </div>
    {/if}

    <!-- All enrolled courses (if more than one) -->
    {#if enrolledCourses.length > 1}
        <div>
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All courses</h2>
                <a href="/my-courses" class="text-xs text-primary hover:underline font-medium">View all</a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {#each enrolledCourses.filter(c => c.id !== resumeCourse?.id).slice(0, 6) as course}
                    <a
                        href="/courses/{course.slug}/learn"
                        class="group flex items-center gap-4 bg-card border border-border/60 rounded-xl p-4 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                    >
                        <div class="w-16 h-11 rounded-lg overflow-hidden shrink-0 bg-muted">
                            <img
                                src={course.thumbnailUrl || DEFAULT_COURSE_IMAGE}
                                alt={course.title}
                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                        <div class="flex-1 min-w-0 space-y-1.5">
                            <p class="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">{course.title}</p>
                            <div class="space-y-1">
                                <Progress value={course.progress} class="h-1" />
                                <p class="text-[11px] text-muted-foreground">{course.progress}% complete</p>
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        </div>
    {/if}
</PageContainer>
