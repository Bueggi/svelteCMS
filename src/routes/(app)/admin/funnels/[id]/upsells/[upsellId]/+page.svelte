<script lang="ts">
    import BlockEditor from '$lib/blocks/BlockEditor.svelte';
    import { Button } from '$lib/components/ui/button';
    import { enhance } from '$app/forms';
    import type { Block } from '$lib/blocks/types';

    let { data } = $props();
    let funnel = $derived(data.funnel);
    let upsell = $derived(data.upsell);
    let blocks = $derived<Block[]>(upsell.blocks ? JSON.parse(upsell.blocks) : []);

    async function handleSave(json: string) {
        const fd = new FormData();
        fd.append('blocks', json);
        const res = await fetch('?/save', { method: 'POST', body: fd });
        if (!res.ok) throw new Error('Save failed');
    }
</script>

<div class="flex h-screen w-full flex-col">
    <div class="flex items-center justify-between border-b bg-background px-4 py-2 shrink-0 gap-4 flex-wrap">
        <div class="flex items-center gap-3 min-w-0">
            <span class="font-semibold text-sm truncate">Upsell: {upsell.course?.title}</span>
            <span class="text-xs px-2 py-1 rounded uppercase shrink-0 {(upsell.status ?? 'draft') === 'public' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}">{upsell.status ?? 'draft'}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <Button variant="outline" href="/admin/funnels/{funnel.id}">Zurück</Button>
            <form action="?/publish" method="POST" use:enhance>
                <input type="hidden" name="status" value={(upsell.status ?? 'draft') === 'draft' ? 'public' : 'draft'} />
                <Button type="submit" variant="secondary">
                    {(upsell.status ?? 'draft') === 'draft' ? 'Veröffentlichen' : 'Depublizieren'}
                </Button>
            </form>
            <Button variant="outline" onclick={() => window.open(`/f/${funnel.slug}/u/${upsell.id}`, '_blank')}>Vorschau</Button>
        </div>
    </div>
    <div class="flex-1 overflow-hidden">
        <BlockEditor {blocks} context="landing" onSave={handleSave} />
    </div>
</div>
