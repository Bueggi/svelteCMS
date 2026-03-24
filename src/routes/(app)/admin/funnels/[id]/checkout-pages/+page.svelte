<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Badge } from '$lib/components/ui/badge';
    import { toast } from 'svelte-sonner';
    import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-svelte';

    let { data } = $props();
    let funnel = $derived(data.funnel);

    let newName = $state('');
    let newSlug = $state('');

    function autoSlug(name: string) {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-serif font-bold">Checkout-Seiten</h1>
            <p class="text-sm text-muted-foreground mt-1">Funnel: {funnel.name}</p>
        </div>
        <Button href="/admin/funnels/{funnel.id}" variant="outline" size="sm">← Zurück</Button>
    </div>

    <details class="border rounded-xl p-6">
        <summary class="cursor-pointer font-medium flex items-center gap-2"><Plus class="w-4 h-4" /> Neue Checkout-Seite</summary>
        <form method="POST" action="/admin/funnels/{funnel.id}?/addCheckoutPage"
            use:enhance={() => ({ result, update }) => {
                if (result.type === 'success') { toast.success('Seite erstellt'); newName = ''; newSlug = ''; }
                else toast.error('Fehler');
                update();
            }}
            class="mt-4 space-y-3">
            <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                    <Label>Name</Label>
                    <Input name="name" bind:value={newName} oninput={() => newSlug = autoSlug(newName)} placeholder="Standard Checkout" required />
                </div>
                <div class="space-y-1">
                    <Label>Slug</Label>
                    <Input name="slug" bind:value={newSlug} placeholder="standard-checkout" required />
                </div>
            </div>
            <Button type="submit" size="sm">Erstellen</Button>
        </form>
    </details>

    {#if funnel.checkoutPages?.length === 0}
        <div class="border rounded-xl p-12 text-center text-muted-foreground">
            <p class="font-medium">Noch keine Checkout-Seiten</p>
            <p class="text-sm mt-1">Erstelle deine erste Checkout-Seite oben.</p>
        </div>
    {:else}
        <div class="border rounded-xl overflow-hidden">
            <table class="w-full text-sm">
                <thead class="bg-muted/50 border-b">
                    <tr>
                        <th class="text-left px-4 py-3 font-medium">Name</th>
                        <th class="text-left px-4 py-3 font-medium">URL</th>
                        <th class="text-left px-4 py-3 font-medium">Status</th>
                        <th class="px-4 py-3"></th>
                    </tr>
                </thead>
                <tbody>
                    {#each funnel.checkoutPages as cp}
                        <tr class="border-b last:border-0 hover:bg-muted/20">
                            <td class="px-4 py-3 font-medium">{cp.name}</td>
                            <td class="px-4 py-3">
                                <a href="/f/{funnel.slug}/c/{cp.id}" target="_blank" class="text-primary flex items-center gap-1 hover:underline">
                                    /f/{funnel.slug}/c/{cp.id} <ExternalLink class="w-3 h-3" />
                                </a>
                            </td>
                            <td class="px-4 py-3">
                                <Badge variant={cp.status === 'public' ? 'default' : 'outline'}>{cp.status}</Badge>
                            </td>
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-2 justify-end">
                                    <Button href="/admin/funnels/{funnel.id}/checkout-pages/{cp.id}" variant="ghost" size="icon" class="h-8 w-8">
                                        <Pencil class="w-4 h-4" />
                                    </Button>
                                    <form method="POST" action="/admin/funnels/{funnel.id}?/removeCheckoutPage"
                                        use:enhance={() => ({ result, update }) => {
                                            if (result.type === 'success') toast.success('Seite gelöscht');
                                            update();
                                        }}>
                                        <input type="hidden" name="id" value={cp.id} />
                                        <Button type="submit" variant="ghost" size="icon" class="h-8 w-8 text-destructive"><Trash2 class="w-4 h-4" /></Button>
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
