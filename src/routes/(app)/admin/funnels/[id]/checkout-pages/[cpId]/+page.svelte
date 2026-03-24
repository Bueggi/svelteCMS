<script lang="ts">
    import BlockEditor from '$lib/blocks/BlockEditor.svelte';
    import { Button } from '$lib/components/ui/button';
    import { enhance } from '$app/forms';
    import type { Block } from '$lib/blocks/types';

    let { data } = $props();
    let cp = $derived(data.cp);
    let blocks = $derived<Block[]>(cp.blocks ? JSON.parse(cp.blocks) : []);

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
            <span class="font-semibold text-sm truncate">Checkout: {cp.name}</span>
            <span class="text-xs px-2 py-1 rounded uppercase shrink-0 {(cp.status) === 'public' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}">{cp.status}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            <Button variant="outline" href="/admin/funnels/{cp.funnel?.id}/checkout-pages">Zurück</Button>
            <form action="?/publish" method="POST" use:enhance>
                <input type="hidden" name="status" value={cp.status === 'draft' ? 'public' : 'draft'} />
                <Button type="submit" variant="secondary">
                    {cp.status === 'draft' ? 'Veröffentlichen' : 'Depublizieren'}
                </Button>
            </form>
            <Button variant="outline" onclick={() => window.open(`/f/${cp.funnel?.slug}/c/${cp.id}`, '_blank')}>Vorschau</Button>
        </div>
    </div>
    <div class="flex-1 overflow-hidden">
        <BlockEditor {blocks} context="checkout" onSave={handleSave} />
    </div>
</div>
