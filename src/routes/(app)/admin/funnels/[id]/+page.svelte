<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Badge } from '$lib/components/ui/badge';
    import { toast } from 'svelte-sonner';
    import { ExternalLink, Plus, Trash2, ArrowRight, GripVertical, FileText, ShoppingCart, CheckSquare, Layers } from 'lucide-svelte';

    let { data } = $props();
    let funnel = $derived(data.funnel);
    let courses = $derived(data.courses);

    let activeTab = $state<'settings' | 'pages' | 'upsells'>('pages');

    // Upsell editing
    let editingUpsellId = $state<string | null>(null);
    let editingUpsellBody = $state('');

    // Add upsell form
    let newUpsellCourseId = $state('');
    let newUpsellPrice = $state('');

    // Add bump form
    let newBumpCourseId = $state('');
    let newBumpLabel = $state('');
    let newBumpPrice = $state('');

    // Add checkout page form
    let newCpName = $state('');
    let newCpSlug = $state('');

    function formatPrice(cents: number | null) {
        if (cents == null) return '—';
        return '€' + (cents / 100).toFixed(2).replace('.', ',');
    }

    function autoSlug(name: string) {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    function enhance_toast(msg: string) {
        return () => ({ result, update }: any) => {
            if (result.type === 'success') toast.success(msg);
            else toast.error('Fehler beim Speichern');
            update();
        };
    }
</script>

<div class="space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-xl font-serif font-bold">{funnel.name}</h1>
            <div class="flex items-center gap-2 mt-1">
                <a href="/f/{funnel.slug}" target="_blank" class="text-sm text-primary hover:underline flex items-center gap-1">
                    /f/{funnel.slug} <ExternalLink class="w-3 h-3" />
                </a>
                <Badge variant={funnel.isActive ? 'default' : 'outline'} class="text-xs">{funnel.isActive ? 'Aktiv' : 'Inaktiv'}</Badge>
            </div>
        </div>
        <Button href="/admin/funnels" variant="outline" size="sm">← Alle Funnels</Button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b">
        {#each [['pages','Seiten'],['upsells','Upsell-Seiten'],['settings','Einstellungen']] as [key, label]}
            <button
                onclick={() => activeTab = key as any}
                class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px {activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
            >
                {label}
            </button>
        {/each}
    </div>

    <!-- PAGES TAB -->
    {#if activeTab === 'pages'}
        <div class="grid gap-4 md:grid-cols-3">
            <!-- Sales Page Card -->
            <div class="border rounded-xl p-6 space-y-3">
                <div class="flex items-center gap-2">
                    <div class="p-2 bg-primary/10 rounded-lg"><FileText class="w-5 h-5 text-primary" /></div>
                    <div>
                        <p class="font-semibold">Sales Page</p>
                        <p class="text-xs uppercase tracking-widest font-medium {(funnel.salesPageStatus ?? 'draft') === 'public' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-500'}">{funnel.salesPageStatus ?? 'draft'}</p>
                    </div>
                </div>
                <p class="text-sm text-muted-foreground">Gestalte deine Landing Page frei mit dem Page Builder.</p>
                <div class="flex gap-2 pt-2">
                    <Button href="/admin/funnels/{funnel.id}/sales-page" class="flex-1">
                        Page Builder öffnen
                    </Button>
                    <Button href="/f/{funnel.slug}" target="_blank" variant="outline" size="icon">
                        <ExternalLink class="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <!-- Checkout Pages Card -->
            <div class="border rounded-xl p-6 space-y-3">
                <div class="flex items-center gap-2">
                    <div class="p-2 bg-green-500/10 rounded-lg"><ShoppingCart class="w-5 h-5 text-green-600" /></div>
                    <div>
                        <p class="font-semibold">Checkout-Seiten</p>
                        <p class="text-xs text-muted-foreground">{funnel.checkoutPages?.length ?? 0} Seiten</p>
                    </div>
                </div>
                <p class="text-sm text-muted-foreground">Erstelle unbegrenzt Checkout-Seiten mit individuellem Design.</p>
                <Button href="/admin/funnels/{funnel.id}/checkout-pages" class="w-full" variant="outline">
                    Checkout-Seiten verwalten
                </Button>
            </div>

            <!-- Thank You Page Card -->
            <div class="border rounded-xl p-6 space-y-3">
                <div class="flex items-center gap-2">
                    <div class="p-2 bg-yellow-500/10 rounded-lg"><CheckSquare class="w-5 h-5 text-yellow-600" /></div>
                    <div>
                        <p class="font-semibold">Dankeseite</p>
                        <p class="text-xs uppercase tracking-widest font-medium {(funnel.thankYouPageStatus ?? 'draft') === 'public' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-500'}">{funnel.thankYouPageStatus ?? 'draft'}</p>
                    </div>
                </div>
                <p class="text-sm text-muted-foreground">Gestalte deine individuelle Dankeseite nach dem Kauf.</p>
                <div class="flex gap-2 pt-2">
                    <Button href="/admin/funnels/{funnel.id}/thank-you" class="flex-1">
                        Page Builder öffnen
                    </Button>
                    <Button href="/f/{funnel.slug}/thank-you" target="_blank" variant="outline" size="icon">
                        <ExternalLink class="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>

        <!-- Order Bumps section -->
        <div class="border rounded-xl p-6 space-y-4">
            <div>
                <h2 class="font-semibold">Order Bumps</h2>
                <p class="text-sm text-muted-foreground mt-1">Werden als Zusatz-Angebote auf der Sales Page und im Checkout angezeigt.</p>
            </div>
            {#each funnel.bumps as bump}
                <div class="flex items-center gap-3 border rounded-lg p-3">
                    <GripVertical class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                        <p class="font-medium text-sm truncate">{bump.course?.title}</p>
                        {#if bump.label}<p class="text-xs text-muted-foreground">{bump.label}</p>{/if}
                        <p class="text-xs text-muted-foreground">{bump.specialPrice != null ? formatPrice(bump.specialPrice) : formatPrice(bump.course?.price ?? null)}</p>
                    </div>
                    <form method="POST" action="?/removeBump" use:enhance={enhance_toast('Bump entfernt')}>
                        <input type="hidden" name="id" value={bump.id} />
                        <Button type="submit" variant="ghost" size="icon" class="h-8 w-8 text-destructive"><Trash2 class="w-4 h-4" /></Button>
                    </form>
                </div>
            {/each}
            <details class="border rounded-lg p-4">
                <summary class="cursor-pointer text-sm font-medium flex items-center gap-2"><Plus class="w-4 h-4" /> Order Bump hinzufügen</summary>
                <form method="POST" action="?/addBump" use:enhance={enhance_toast('Bump hinzugefügt')} class="mt-4 space-y-3">
                    <div class="space-y-1">
                        <Label>Produkt</Label>
                        <select name="courseId" bind:value={newBumpCourseId} required class="w-full border rounded-md px-3 py-2 text-sm bg-background">
                            <option value="">Kurs auswählen…</option>
                            {#each courses as c}<option value={c.id}>{c.title}</option>{/each}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <Label>Label (optional)</Label>
                        <Input name="label" bind:value={newBumpLabel} placeholder="Füge das Advanced Modul für nur €97 hinzu!" />
                    </div>
                    <div class="space-y-1">
                        <Label>Sonderpreis (€, optional)</Label>
                        <Input name="specialPrice" bind:value={newBumpPrice} type="number" placeholder="97" />
                    </div>
                    <Button type="submit" size="sm">Bump hinzufügen</Button>
                </form>
            </details>
        </div>
    {/if}

    <!-- UPSELLS TAB -->
    {#if activeTab === 'upsells'}
        <div class="space-y-4">
            <p class="text-sm text-muted-foreground">Post-Purchase Upsell-Seiten die nach dem Kauf angezeigt werden. Jede Seite bietet ein Produkt an.</p>
            {#each funnel.upsells as upsell, i}
                <div class="border rounded-xl p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-xs text-muted-foreground uppercase tracking-widest">Schritt {i + 1}</p>
                            <p class="font-semibold">{upsell.course?.title}</p>
                            <p class="text-sm text-muted-foreground">{upsell.specialPrice != null ? formatPrice(upsell.specialPrice) : formatPrice(upsell.course?.price ?? null)}</p>
                        </div>
                        <div class="flex gap-2">
                            <Button href="/admin/funnels/{funnel.id}/upsells/{upsell.id}" variant="outline" size="sm">Seite gestalten</Button>
                            <form method="POST" action="?/removeUpsell" use:enhance={enhance_toast('Upsell entfernt')}>
                                <input type="hidden" name="id" value={upsell.id} />
                                <Button type="submit" variant="ghost" size="icon" class="h-8 w-8 text-destructive"><Trash2 class="w-4 h-4" /></Button>
                            </form>
                        </div>
                    </div>
                </div>
            {/each}
            {#if funnel.upsells.length > 0}
                <div class="flex items-center gap-2 text-xs text-muted-foreground pl-4">
                    <ArrowRight class="w-4 h-4" /> Dankeseite
                </div>
            {/if}
            <details class="border rounded-xl p-6">
                <summary class="cursor-pointer font-medium flex items-center gap-2"><Plus class="w-4 h-4" /> Upsell-Seite hinzufügen</summary>
                <form method="POST" action="?/addUpsell" use:enhance={enhance_toast('Upsell hinzugefügt')} class="mt-4 space-y-3">
                    <div class="space-y-1">
                        <Label>Produkt</Label>
                        <select name="courseId" bind:value={newUpsellCourseId} required class="w-full border rounded-md px-3 py-2 text-sm bg-background">
                            <option value="">Kurs auswählen…</option>
                            {#each courses as c}<option value={c.id}>{c.title}</option>{/each}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <Label>Sonderpreis (€, optional)</Label>
                        <Input name="specialPrice" bind:value={newUpsellPrice} type="number" placeholder="Kurspreis verwenden" />
                    </div>
                    <Button type="submit" size="sm">Upsell-Seite hinzufügen</Button>
                </form>
            </details>
        </div>
    {/if}

    <!-- SETTINGS TAB -->
    {#if activeTab === 'settings'}
        <div class="max-w-lg">
            <form method="POST" action="?/updateMeta" use:enhance={enhance_toast('Einstellungen gespeichert')} class="space-y-4 border rounded-xl p-6">
                <h2 class="font-semibold">Funnel-Einstellungen</h2>
                <div class="space-y-2"><Label>Name</Label><Input name="name" value={funnel.name} required /></div>
                <div class="space-y-2">
                    <Label>Slug</Label>
                    <Input name="slug" value={funnel.slug} required />
                    <p class="text-xs text-muted-foreground">URL: /f/{funnel.slug}</p>
                </div>
                <div class="space-y-2">
                    <Label>Status</Label>
                    <select name="isActive" class="w-full border rounded-md px-3 py-2 text-sm bg-background">
                        <option value="true" selected={funnel.isActive}>Aktiv</option>
                        <option value="false" selected={!funnel.isActive}>Inaktiv</option>
                    </select>
                </div>
                <div class="space-y-2">
                    <Label>Hauptprodukt</Label>
                    <p class="text-sm text-muted-foreground border rounded-md px-3 py-2">{funnel.course?.title}</p>
                </div>
                <div class="space-y-2">
                    <Label>Tracking Pixel</Label>
                    <textarea
                        name="trackingPixels"
                        rows={6}
                        class="w-full border rounded-md px-3 py-2 text-sm bg-background font-mono resize-y"
                        placeholder="<!-- Facebook Pixel, Google Tag Manager, etc. -->"
                    >{funnel.trackingPixels ?? ''}</textarea>
                    <p class="text-xs text-muted-foreground">Wird in den &lt;head&gt; aller Funnel-Seiten eingefügt (Sales Page, Upsells, Dankeseite).</p>
                </div>

                <!-- Sandbox Mode -->
                <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-semibold">Sandbox-Modus</p>
                            <p class="text-xs text-muted-foreground mt-0.5">Nutzt Stripe Test-Keys — kein echtes Geld. Funnel ist auch ohne "Aktiv" erreichbar.</p>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="sandboxMode" value="true" class="sr-only peer" checked={funnel.sandboxMode} />
                            <div class="w-10 h-6 bg-muted rounded-full peer peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-4"></div>
                        </label>
                    </div>
                    {#if funnel.sandboxMode}
                        <div class="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                            <span class="text-xs font-mono text-amber-700 dark:text-amber-400 truncate">/f/{funnel.slug}</span>
                            <button
                                type="button"
                                onclick={() => { navigator.clipboard.writeText(window.location.origin + '/f/' + funnel.slug); toast.success('Link kopiert!'); }}
                                class="ml-auto text-xs text-amber-700 dark:text-amber-400 hover:underline shrink-0"
                            >Kopieren</button>
                        </div>
                        <p class="text-xs text-amber-700 dark:text-amber-400">Stripe Test-Keys müssen unter Einstellungen → Integrationen hinterlegt sein.</p>
                    {/if}
                </div>

                <Button type="submit">Speichern</Button>
            </form>
        </div>
    {/if}
</div>
