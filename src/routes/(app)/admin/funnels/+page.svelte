<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Badge } from '$lib/components/ui/badge';
    import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '$lib/components/ui/dialog';
    import { GitBranch, Plus, Pencil, Trash2, ExternalLink } from 'lucide-svelte';

    let { data } = $props();
    let funnels = $derived(data.funnels);
    let courses = $derived(data.courses);

    let newName = $state('');
    let newSlug = $state('');
    let newCourseId = $state('');
    let dialogOpen = $state(false);

    function autoSlug(name: string) {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-serif font-bold">Funnels</h1>
            <p class="text-muted-foreground text-sm mt-1">Create custom sales flows with upsells and thank you pages.</p>
        </div>
        <Dialog bind:open={dialogOpen}>
            <DialogTrigger>
                {#snippet child({ props })}
                    <Button {...props}><Plus class="w-4 h-4 mr-2" />New Funnel</Button>
                {/snippet}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Funnel</DialogTitle>
                </DialogHeader>
                <form method="POST" action="?/create" use:enhance={() => {
                    return ({ result, update }) => {
                        if (result.type === 'success') { dialogOpen = false; newName = ''; newSlug = ''; newCourseId = ''; }
                        update();
                    };
                }} class="space-y-4">
                    <div class="space-y-2">
                        <Label>Funnel Name</Label>
                        <Input name="name" bind:value={newName} oninput={() => newSlug = autoSlug(newName)} placeholder="e.g. Skincare Masterclass Funnel" required />
                    </div>
                    <div class="space-y-2">
                        <Label>Slug <span class="text-muted-foreground text-xs">(URL: /f/your-slug)</span></Label>
                        <Input name="slug" bind:value={newSlug} placeholder="skincare-masterclass" required />
                    </div>
                    <div class="space-y-2">
                        <Label>Main Product (Course)</Label>
                        <select name="courseId" bind:value={newCourseId} required class="w-full border rounded-md px-3 py-2 text-sm bg-background">
                            <option value="">Select course…</option>
                            {#each courses as c}
                                <option value={c.id}>{c.title}</option>
                            {/each}
                        </select>
                    </div>
                    <DialogFooter>
                        <Button type="submit">Create Funnel</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    </div>

    {#if funnels.length === 0}
        <div class="border rounded-xl p-16 text-center text-muted-foreground">
            <GitBranch class="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p class="font-medium">No funnels yet</p>
            <p class="text-sm mt-1">Create your first funnel to start selling with custom flows.</p>
        </div>
    {:else}
        <div class="border rounded-xl overflow-hidden">
            <table class="w-full text-sm">
                <thead class="bg-muted/50 border-b">
                    <tr>
                        <th class="text-left px-4 py-3 font-medium">Name</th>
                        <th class="text-left px-4 py-3 font-medium">Product</th>
                        <th class="text-left px-4 py-3 font-medium">URL</th>
                        <th class="text-left px-4 py-3 font-medium">Status</th>
                        <th class="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {#each funnels as funnel}
                        <tr class="border-b last:border-0 hover:bg-muted/20">
                            <td class="px-4 py-3 font-medium">{funnel.name}</td>
                            <td class="px-4 py-3 text-muted-foreground">{funnel.course?.title ?? '—'}</td>
                            <td class="px-4 py-3">
                                <a href="/f/{funnel.slug}" target="_blank" class="text-primary flex items-center gap-1 hover:underline">
                                    /f/{funnel.slug} <ExternalLink class="w-3 h-3" />
                                </a>
                            </td>
                            <td class="px-4 py-3">
                                <Badge variant={funnel.isActive ? 'default' : 'outline'}>
                                    {funnel.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                            </td>
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-2 justify-end">
                                    <Button href="/admin/funnels/{funnel.id}" variant="ghost" size="icon" class="h-8 w-8">
                                        <Pencil class="w-4 h-4" />
                                    </Button>
                                    <form method="POST" action="?/delete" use:enhance>
                                        <input type="hidden" name="id" value={funnel.id} />
                                        <Button type="submit" variant="ghost" size="icon" class="h-8 w-8 text-destructive">
                                            <Trash2 class="w-4 h-4" />
                                        </Button>
                                    </form>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>
