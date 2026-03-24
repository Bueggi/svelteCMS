<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import { Input } from "$lib/components/ui/input";
    import { ChevronLeft } from "lucide-svelte";
    import { fade } from 'svelte/transition';
    import { PageTitle } from "$lib/components/ui/page-title";

    let isSubmitting = $state(false);
</script>

<div class="max-w-md mx-auto space-y-8" in:fade={{ duration: 300 }}>
    <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/admin/courses">
            <ChevronLeft class="w-5 h-5" />
        </Button>
        <PageTitle>Create New Course</PageTitle>
    </div>

    <form method="POST" use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => {
            await update();
            isSubmitting = false;
        }
    }} class="space-y-6 bg-card p-6 rounded-lg border shadow-sm">
        <div class="space-y-2">
            <Label for="title">Course Title</Label>
            <Input id="title" name="title" placeholder="e.g. Advanced SvelteKit Masterclass" required />
            <p class="text-xs text-muted-foreground">This will be used to generate the course slug.</p>
        </div>

        <div class="flex justify-end gap-2">
            <Button variant="outline" href="/admin/courses" type="button">Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
                {#if isSubmitting}
                    Creating...
                {:else}
                    Create Course
                {/if}
            </Button>
        </div>
    </form>
</div>
