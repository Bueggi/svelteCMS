<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Badge } from "$lib/components/ui/badge";
    import { ChevronLeft, Trash2, Plus, ExternalLink, Receipt, RefreshCcw, KeyRound, Phone, MapPin } from "lucide-svelte";
    import { FormSelect } from "$lib/components/ui/form-select";
    import { PageTitle } from "$lib/components/ui/page-title";
    import { toast } from 'svelte-sonner';

    let { data, form } = $props();
    let profile = $derived(data.profile);
    let enrollments = $derived(data.enrollments);
    let availableCourses = $derived(data.availableCourses);
    let recentActivity = $derived(data.recentActivity);
    let purchases = $derived(data.purchases || []);
    let invoices = $derived(data.invoices || []);

    let isSaving = $state(false);
    let isRefunding = $state<string | null>(null);
    let isSendingReset = $state(false);
    let showDeleteConfirm = $state(false);

    // Show toast when form action returns
    $effect(() => {
        if (form?.success && form?.message) {
            toast.success(form.message);
        } else if (form && !form.success && form?.message) {
            toast.error(form.message);
        }
    });

    function enhanceProfileUpdate() {
        isSaving = true;
        return async ({ update, result }: any) => {
            await update();
            isSaving = false;
        };
    }

    // Parse billing address from invoice JSON
    function parseAddress(json: string | null) {
        if (!json) return null;
        try { return JSON.parse(json); } catch { return null; }
    }

    // Latest billing address across all invoices
    let latestAddress = $derived(() => {
        for (const inv of invoices) {
            const addr = parseAddress(inv.customerAddressJson);
            if (addr) return { ...addr, invoiceNumber: inv.invoiceNumber, customerName: inv.customerName, customerEmail: inv.customerEmail, customerVatId: inv.customerVatId };
        }
        return null;
    });
</script>

<div class="space-y-6 max-w-5xl mx-auto pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Header -->
    <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/admin/users">
            <ChevronLeft class="w-5 h-5" />
        </Button>
        <div>
            <PageTitle>{profile.name}</PageTitle>
            <div class="flex items-center gap-2 text-muted-foreground text-sm">
                <span>{profile.email}</span>
                <span>•</span>
                <span>Registriert: {new Date(profile.createdAt).toLocaleDateString('de-DE')}</span>
            </div>
        </div>
        <div class="ml-auto flex items-center gap-3">
            <Badge variant={profile.role === 'admin' ? 'default' : 'secondary'}>
                {profile.role}
            </Badge>

            <!-- Password reset -->
            <form method="POST" action="?/sendPasswordReset" use:enhance={() => {
                isSendingReset = true;
                return async ({ update }) => { await update(); isSendingReset = false; };
            }}>
                <Button type="submit" variant="outline" size="sm" disabled={isSendingReset} class="gap-1.5">
                    <KeyRound class="w-3.5 h-3.5" />
                    {isSendingReset ? 'Wird gesendet…' : 'Neues Passwort senden'}
                </Button>
            </form>

            <!-- Delete -->
            {#if !showDeleteConfirm}
                <Button variant="destructive" size="sm" onclick={() => showDeleteConfirm = true}>
                    <Trash2 class="w-4 h-4 mr-1" />
                    Löschen
                </Button>
            {:else}
                <div class="flex items-center gap-2">
                    <span class="text-sm text-destructive font-medium">Wirklich löschen?</span>
                    <form method="POST" action="?/deleteUser" use:enhance>
                        <Button type="submit" variant="destructive" size="sm">Ja, löschen</Button>
                    </form>
                    <Button variant="ghost" size="sm" onclick={() => showDeleteConfirm = false}>Abbrechen</Button>
                </div>
            {/if}
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Left Column -->
        <div class="lg:col-span-1 space-y-6">

            <!-- Profile form -->
            <form method="POST" action="?/updateProfile" use:enhance={enhanceProfileUpdate} class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <h2 class="font-semibold text-lg">Profil</h2>

                <div class="space-y-2">
                    <Label for="name">Name</Label>
                    <Input id="name" name="name" value={profile.name} required />
                </div>

                <div class="space-y-2">
                    <Label for="email">E-Mail</Label>
                    <Input id="email" name="email" type="email" value={profile.email} required />
                </div>

                <div class="space-y-2">
                    <Label for="phone" class="flex items-center gap-1.5">
                        <Phone class="w-3.5 h-3.5" /> Telefon
                    </Label>
                    <Input id="phone" name="phone" type="tel" value={profile.phone ?? ''} placeholder="+49 123 456789" />
                </div>

                <div class="space-y-2">
                    <Label for="role">Rolle</Label>
                    <FormSelect id="role" name="role" value={profile.role}>
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="admin">Admin</option>
                    </FormSelect>
                </div>

                <Button type="submit" class="w-full" disabled={isSaving}>
                    {isSaving ? 'Wird gespeichert…' : 'Änderungen speichern'}
                </Button>
            </form>

            <!-- Latest billing address from invoices -->
            {#if latestAddress()}
                {@const addr = latestAddress()}
                <div class="bg-card p-6 rounded-lg border shadow-sm space-y-3">
                    <h2 class="font-semibold text-lg flex items-center gap-2">
                        <MapPin class="w-4 h-4" /> Rechnungsadresse
                    </h2>
                    <div class="text-sm space-y-1">
                        <p class="font-medium">{addr.customerName}</p>
                        {#if addr.line1}<p class="text-muted-foreground">{addr.line1}</p>{/if}
                        {#if addr.line2}<p class="text-muted-foreground">{addr.line2}</p>{/if}
                        {#if addr.postal_code || addr.city}
                            <p class="text-muted-foreground">{addr.postal_code} {addr.city}</p>
                        {/if}
                        {#if addr.country}<p class="text-muted-foreground">{addr.country}</p>{/if}
                        {#if addr.customerVatId}
                            <p class="text-muted-foreground text-xs mt-1">USt-ID: {addr.customerVatId}</p>
                        {/if}
                    </div>
                    <p class="text-[11px] text-muted-foreground/60">Aus Rechnung {addr.invoiceNumber}</p>
                </div>
            {/if}

            <!-- Purchase History -->
            <div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <h2 class="font-semibold text-lg flex items-center gap-2">
                    <Receipt class="w-4 h-4" /> Kaufhistorie
                </h2>

                {#if purchases.length === 0}
                    <div class="text-sm text-muted-foreground">Keine Käufe vorhanden.</div>
                {:else}
                    <div class="space-y-4">
                        {#each purchases as purchase}
                            <div class="flex flex-col gap-2 p-3 bg-muted/30 rounded-md border">
                                <div class="flex justify-between items-start">
                                    <span class="font-medium text-sm">{purchase.course.title}</span>
                                    <span class="font-mono text-sm">€{(purchase.amount / 100).toFixed(2)}</span>
                                </div>
                                <div class="flex justify-between items-center text-xs text-muted-foreground">
                                    <span>{new Date(purchase.createdAt).toLocaleDateString('de-DE')}</span>
                                    <Badge variant={purchase.status === 'refunded' ? 'destructive' : 'outline'} class="text-[10px] h-5 px-1.5 uppercase">
                                        {purchase.status}
                                    </Badge>
                                </div>

                                {#if purchase.status !== 'refunded'}
                                    <form action="?/refundPurchase" method="POST" use:enhance={() => {
                                        isRefunding = purchase.id;
                                        return async ({ update }) => { await update(); isRefunding = null; };
                                    }}>
                                        <input type="hidden" name="purchaseId" value={purchase.id} />
                                        <Button type="submit" variant="ghost" size="sm" class="w-full mt-2 h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={isRefunding === purchase.id}>
                                            <RefreshCcw class="w-3 h-3 mr-1.5" />
                                            {isRefunding === purchase.id ? 'Wird erstattet…' : 'Erstatten'}
                                        </Button>
                                    </form>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <!-- Right Column -->
        <div class="lg:col-span-2 space-y-6">

            <!-- Course access -->
            <div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <div class="flex items-center justify-between">
                    <h2 class="font-semibold text-lg">Kurszugang</h2>
                </div>

                {#if enrollments.length === 0}
                    <div class="text-sm text-muted-foreground py-4 border-2 border-dashed rounded-md text-center">
                        Keine aktiven Einschreibungen.
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each enrollments as enrollment (enrollment.courseId)}
                            <div class="p-3 bg-muted/30 rounded-md border space-y-2">
                                <div class="flex items-center justify-between">
                                    <div class="font-medium">{enrollment.course.title}</div>
                                    <div class="flex items-center gap-2">
                                        <Badge variant={enrollment.status === 'active' ? 'outline' : 'secondary'} class={enrollment.status === 'active' ? 'bg-green-500/10 text-green-600 border-green-200' : ''}>
                                            {enrollment.status}
                                        </Badge>
                                        <form action="?/removeEnrollment" method="POST" use:enhance>
                                            <input type="hidden" name="courseId" value={enrollment.courseId} />
                                            <Button type="submit" variant="ghost" size="icon" class="h-6 w-6 text-destructive hover:bg-destructive/10">
                                                <Trash2 class="w-3 h-3" />
                                            </Button>
                                        </form>
                                    </div>
                                </div>
                                <div class="text-xs text-muted-foreground flex items-center justify-between">
                                    <span>Eingeschrieben: {new Date(enrollment.enrolledAt).toLocaleDateString('de-DE')}</span>
                                    {#if enrollment.expiresAt}
                                        <span class="font-medium {new Date(enrollment.expiresAt) < new Date() ? 'text-destructive' : 'text-orange-600'}">
                                            Läuft ab: {new Date(enrollment.expiresAt).toLocaleDateString('de-DE')}
                                        </span>
                                    {:else}
                                        <span>Lebenslanger Zugang</span>
                                    {/if}
                                </div>

                                {#if enrollment.expiresAt || enrollment.status !== 'active'}
                                    <div class="pt-2 border-t flex justify-end gap-2">
                                        {#if enrollment.status === 'active' && enrollment.expiresAt}
                                            <form action="?/updateEnrollment" method="POST" use:enhance>
                                                <input type="hidden" name="courseId" value={enrollment.courseId} />
                                                <input type="hidden" name="status" value="cancelled" />
                                                <input type="hidden" name="expiresAt" value={enrollment.expiresAt} />
                                                <Button type="submit" variant="ghost" size="sm" class="h-6 text-[10px] text-destructive">
                                                    Abo kündigen
                                                </Button>
                                            </form>
                                        {/if}
                                        {#if enrollment.status === 'cancelled'}
                                            <form action="?/updateEnrollment" method="POST" use:enhance>
                                                <input type="hidden" name="courseId" value={enrollment.courseId} />
                                                <input type="hidden" name="status" value="active" />
                                                <input type="hidden" name="expiresAt" value={enrollment.expiresAt} />
                                                <Button type="submit" variant="ghost" size="sm" class="h-6 text-[10px] text-primary">
                                                    Reaktivieren
                                                </Button>
                                            </form>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                <div class="pt-4 border-t">
                    <h3 class="text-sm font-medium mb-2">Zugang gewähren</h3>
                    <form action="?/addEnrollment" method="POST" use:enhance class="flex gap-2">
                        <FormSelect name="courseId" required>
                            <option value="" disabled selected>Kurs auswählen…</option>
                            {#each availableCourses as course}
                                <option value={course.id}>{course.title}</option>
                            {/each}
                        </FormSelect>
                        <Button type="submit" variant="secondary">
                            <Plus class="w-4 h-4 mr-2" /> Hinzufügen
                        </Button>
                    </form>
                </div>
            </div>

            <!-- All invoices with billing details -->
            {#if invoices.length > 0}
                <div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                    <h2 class="font-semibold text-lg flex items-center gap-2">
                        <Receipt class="w-4 h-4" /> Rechnungen & Adressen
                    </h2>
                    <div class="space-y-3">
                        {#each invoices as inv}
                            {@const addr = parseAddress(inv.customerAddressJson)}
                            <div class="p-3 bg-muted/30 rounded-md border text-sm">
                                <div class="flex justify-between items-start">
                                    <span class="font-medium">{inv.invoiceNumber}</span>
                                    <span class="font-mono">€{(inv.totalCents / 100).toFixed(2)}</span>
                                </div>
                                <p class="text-xs text-muted-foreground mt-0.5">
                                    {new Date(inv.invoiceDate).toLocaleDateString('de-DE')} · {inv.customerName} · {inv.customerEmail}
                                </p>
                                {#if addr}
                                    <p class="text-xs text-muted-foreground mt-0.5">
                                        {[addr.line1, addr.postal_code, addr.city, addr.country].filter(Boolean).join(', ')}
                                    </p>
                                {/if}
                                {#if inv.customerVatId}
                                    <p class="text-xs text-muted-foreground">USt-ID: {inv.customerVatId}</p>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Recent Community Activity -->
            <div class="bg-card p-6 rounded-lg border shadow-sm space-y-4">
                <h2 class="font-semibold text-lg">Community-Aktivität</h2>

                {#if recentActivity.length === 0}
                    <div class="text-sm text-muted-foreground">Keine Beiträge.</div>
                {:else}
                    <div class="space-y-4">
                        {#each recentActivity as post}
                            <div class="flex gap-3 items-start border-b last:border-0 pb-4 last:pb-0">
                                <div class="flex-1 space-y-1">
                                    <div class="font-medium text-sm flex items-center justify-between">
                                        {post.title}
                                        <span class="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleDateString('de-DE')}</span>
                                    </div>
                                    <div class="text-xs text-muted-foreground line-clamp-2">{post.body}</div>
                                    <div class="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" class="text-[10px] h-5">{post.category.name}</Badge>
                                        <a href="/community/posts/{post.id}" target="_blank" class="text-xs text-primary flex items-center hover:underline">
                                            Beitrag ansehen <ExternalLink class="w-3 h-3 ml-1" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
