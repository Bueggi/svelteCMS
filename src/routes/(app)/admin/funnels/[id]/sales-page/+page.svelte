<script lang="ts">
    import BlockEditor from '$lib/blocks/BlockEditor.svelte';
    import { Button } from '$lib/components/ui/button';
    import { enhance } from '$app/forms';
    import type { Block } from '$lib/blocks/types';

    let { data } = $props();
    let funnel = $derived(data.funnel);
    let blocks = $derived<Block[]>(funnel.salesPageBlocks ? JSON.parse(funnel.salesPageBlocks) : []);

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
            <span class="font-semibold text-sm truncate">Sales Page: {funnel.name}</span>
            <span class="text-xs px-2 py-1 rounded uppercase shrink-0 {(funnel.salesPageStatus ?? 'draft') === 'public' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}">{funnel.salesPageStatus ?? 'draft'}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0 flex-wrap">
            <div class="flex items-center border border-border/60 rounded-lg overflow-hidden text-xs shrink-0">
                <form action="?/setCheckoutMode" method="POST" use:enhance>
                    <input type="hidden" name="checkoutMode" value="separate" />
                    <button type="submit" class="px-3 py-1.5 transition-colors {(funnel.checkoutMode ?? 'separate') === 'separate' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted'}">
                        Separate Checkout-Seite
                    </button>
                </form>
                <div class="w-px h-5 bg-border/60"></div>
                <form action="?/setCheckoutMode" method="POST" use:enhance>
                    <input type="hidden" name="checkoutMode" value="embedded" />
                    <button type="submit" class="px-3 py-1.5 transition-colors {(funnel.checkoutMode ?? 'separate') === 'embedded' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted'}">
                        Checkout eingebettet
                    </button>
                </form>
            </div>
            <Button variant="outline" href="/admin/funnels/{funnel.id}">Zurück</Button>
            <form action="?/publish" method="POST" use:enhance>
                <input type="hidden" name="status" value={(funnel.salesPageStatus ?? 'draft') === 'draft' ? 'public' : 'draft'} />
                <Button type="submit" variant="secondary">
                    {(funnel.salesPageStatus ?? 'draft') === 'draft' ? 'Veröffentlichen' : 'Depublizieren'}
                </Button>
            </form>
            <Button variant="outline" onclick={() => window.open(`/f/${funnel.slug}`, '_blank')}>Vorschau</Button>
        </div>
    </div>
    <div class="flex-1 overflow-hidden">
        <BlockEditor {blocks} context="landing" checkoutMode={funnel.checkoutMode ?? 'separate'} onSave={handleSave} />
    </div>
</div>
