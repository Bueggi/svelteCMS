<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { DEFAULT_COURSE_IMAGE } from "$lib/constants";
    import { Users, MessageSquare } from "lucide-svelte";

    let { data } = $props();
    let communities = $derived(data.communities);
</script>

<PageContainer>
    <PageHeader title="Community" description="Connect with fellow students and instructors." />

    {#if communities.length > 0}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each communities as community}
                <a
                    href="/community/{community.slug}"
                    class="group block bg-card border border-border/60 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                >
                    <div class="aspect-video relative overflow-hidden bg-muted">
                        <img
                            src={community.thumbnailUrl || DEFAULT_COURSE_IMAGE}
                            alt={community.title}
                            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-5">
                            <h3 class="text-white font-semibold text-lg font-serif leading-tight">{community.title}</h3>
                        </div>
                    </div>
                    <div class="px-5 py-4 flex items-center gap-5 text-sm text-muted-foreground border-t border-border/40">
                        <span class="flex items-center gap-1.5">
                            <Users class="w-4 h-4" /> Members
                        </span>
                        <span class="flex items-center gap-1.5">
                            <MessageSquare class="w-4 h-4" /> Discussions
                        </span>
                    </div>
                </a>
            {/each}
        </div>
    {:else}
        <div class="flex flex-col items-center justify-center py-20 text-center bg-card border border-dashed border-border rounded-2xl">
            <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Users class="w-8 h-8 text-primary" />
            </div>
            <h2 class="text-xl font-semibold text-foreground mb-2">No communities yet</h2>
            <p class="text-muted-foreground max-w-sm mb-6 text-sm">
                You're not enrolled in any courses with active communities.
            </p>
            <Button href="/courses">Browse Courses</Button>
        </div>
    {/if}
</PageContainer>
