<script lang="ts">
    import { PageContainer } from '$lib/components/ui/page-container';
    import { PageHeader } from '$lib/components/ui/page-header';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import {
        Images, Upload, Trash2, Search, X, Loader2, Copy, Check, ExternalLink
    } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';

    let { data } = $props();

    interface MediaFile {
        id: number;
        url: string;
        originalName: string | null;
        filename: string;
        width: number | null;
        height: number | null;
        size: number | null;
        mimeType: string | null;
        createdAt: Date | string;
    }

    let files = $state<MediaFile[]>(data.files as MediaFile[]);
    let query = $state('');
    let uploading = $state(false);
    let deleting = $state<Set<number>>(new Set());
    let loading = $state(false);
    let page = $state(0);
    let hasMore = $state(data.files.length === 80);
    let copied = $state<number | null>(null);
    let selected = $state<MediaFile | null>(null);

    let searchTimeout: ReturnType<typeof setTimeout>;

    function onSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadFiles(true), 300);
    }

    async function loadFiles(reset = false) {
        if (reset) { page = 0; }
        loading = true;
        try {
            const params = new URLSearchParams({ page: String(reset ? 0 : page) });
            if (query) params.set('q', query);
            const res = await fetch(`/api/admin/media?${params}`);
            const d = await res.json();
            files = reset ? d.files : [...files, ...d.files];
            hasMore = d.hasMore;
            if (!reset) page++;
        } finally {
            loading = false;
        }
    }

    async function handleUpload(e: Event) {
        const fileList = (e.target as HTMLInputElement).files;
        if (!fileList?.length) return;
        uploading = true;
        let uploaded = 0;
        const errors: string[] = [];
        try {
            for (const file of Array.from(fileList)) {
                const fd = new FormData();
                fd.append('file', file);
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                if (res.ok) {
                    uploaded++;
                    const body = await res.json().catch(() => ({}));
                    if (body.thumbnailsGenerated === false) {
                        toast.warning(`${file.name}: Bild gespeichert, aber Thumbnails konnten nicht erstellt werden (Sharp-Fehler auf dem Server). Bitte "npm rebuild sharp" auf dem Server ausführen.`, { duration: 10000 });
                    }
                } else {
                    let reason = `HTTP ${res.status}`;
                    try {
                        const body = await res.json();
                        reason = body.message ?? body.error ?? reason;
                    } catch { /* non-JSON response */ }
                    errors.push(`${file.name}: ${reason}`);
                }
            }
            if (uploaded > 0) {
                toast.success(`${uploaded} Datei${uploaded !== 1 ? 'en' : ''} hochgeladen`);
                await loadFiles(true);
            }
            for (const msg of errors) {
                toast.error(msg, { duration: 8000 });
            }
        } catch (err: any) {
            toast.error(`Upload fehlgeschlagen: ${err?.message ?? 'Unbekannter Fehler'}`);
        } finally {
            uploading = false;
            (e.target as HTMLInputElement).value = '';
        }
    }

    async function deleteFile(file: MediaFile) {
        if (!confirm(`"${file.originalName ?? file.filename}" wirklich löschen?`)) return;
        deleting = new Set([...deleting, file.id]);
        try {
            const res = await fetch('/api/admin/media', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: file.id }),
            });
            if ((await res.json()).ok) {
                files = files.filter(f => f.id !== file.id);
                if (selected?.id === file.id) selected = null;
                toast.success('Datei gelöscht');
            }
        } finally {
            deleting = new Set([...deleting].filter(id => id !== file.id));
        }
    }

    async function copyUrl(file: MediaFile) {
        await navigator.clipboard.writeText(file.url);
        copied = file.id;
        setTimeout(() => copied = null, 1500);
    }

    function formatSize(bytes: number | null) {
        if (!bytes) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }

    function formatDate(d: Date | string) {
        return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
</script>

<PageContainer variant="admin">
    <PageHeader title="Mediathek" description="Alle hochgeladenen Dateien verwalten.">
        {#snippet actions()}
            <label class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors {uploading ? 'opacity-60 pointer-events-none' : ''}">
                {#if uploading}
                    <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                    <Upload class="w-4 h-4" />
                {/if}
                {uploading ? 'Lädt hoch…' : 'Hochladen'}
                <input type="file" accept="image/*" multiple class="sr-only" disabled={uploading} onchange={handleUpload} />
            </label>
        {/snippet}
    </PageHeader>

    <div class="flex gap-6 mt-6">
        <!-- Main grid -->
        <div class="flex-1 min-w-0 space-y-4">
            <!-- Search bar -->
            <div class="relative max-w-sm">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Dateiname suchen…"
                    bind:value={query}
                    oninput={onSearch}
                    class="pl-9"
                />
            </div>

            {#if files.length === 0 && !loading}
                <div class="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3 border-2 border-dashed border-border rounded-xl">
                    <Images class="w-10 h-10 opacity-30" />
                    <p class="text-sm">Noch keine Bilder hochgeladen.</p>
                    <label class="text-sm text-primary underline underline-offset-2 cursor-pointer hover:opacity-80">
                        Erstes Bild hochladen
                        <input type="file" accept="image/*" class="sr-only" onchange={handleUpload} />
                    </label>
                </div>
            {:else}
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
                    {#each files as file}
                        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                        <div
                            onclick={() => selected = selected?.id === file.id ? null : file}
                            class="group relative aspect-square rounded-lg overflow-hidden border-2 bg-muted/30 transition-all hover:scale-[1.02] cursor-pointer {selected?.id === file.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/30'}"
                            title={file.originalName ?? file.filename}
                        >
                            <img
                                src={file.url400 ?? file.url}
                                alt={file.originalName ?? ''}
                                class="w-full h-full object-cover"
                                loading="lazy"
                                style={file.blurDataUrl ? `background-image:url("${file.blurDataUrl}");background-size:cover` : ''}
                            />
                            <!-- Hover overlay with delete -->
                            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1.5">
                                <button
                                    type="button"
                                    onclick={(e) => { e.stopPropagation(); deleteFile(file); }}
                                    disabled={deleting.has(file.id)}
                                    class="w-6 h-6 rounded bg-destructive/90 text-white flex items-center justify-center hover:bg-destructive transition-colors"
                                >
                                    {#if deleting.has(file.id)}
                                        <Loader2 class="w-3.5 h-3.5 animate-spin" />
                                    {:else}
                                        <Trash2 class="w-3.5 h-3.5" />
                                    {/if}
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>

                {#if hasMore}
                    <div class="flex justify-center pt-2">
                        <Button variant="outline" size="sm" onclick={() => loadFiles()} disabled={loading}>
                            {loading ? 'Lädt…' : 'Mehr laden'}
                        </Button>
                    </div>
                {/if}
            {/if}
        </div>

        <!-- Detail panel -->
        {#if selected}
            <aside class="w-64 shrink-0 space-y-4 sticky top-6 self-start">
                <div class="rounded-xl border border-border bg-card/50 overflow-hidden">
                    <img src={selected.url} alt={selected.originalName ?? ''} class="w-full aspect-square object-contain bg-muted/40 p-2" />

                    <div class="p-4 space-y-3">
                        <div>
                            <p class="text-sm font-medium truncate" title={selected.originalName ?? selected.filename}>
                                {selected.originalName ?? selected.filename}
                            </p>
                            <p class="text-xs text-muted-foreground font-mono truncate mt-0.5">{selected.filename}</p>
                        </div>

                        <div class="text-xs text-muted-foreground space-y-1">
                            {#if selected.width && selected.height}
                                <div class="flex justify-between">
                                    <span>Auflösung</span>
                                    <span class="font-medium text-foreground">{selected.width} × {selected.height}</span>
                                </div>
                            {/if}
                            <div class="flex justify-between">
                                <span>Größe</span>
                                <span class="font-medium text-foreground">{formatSize(selected.size)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Format</span>
                                <span class="font-medium text-foreground">{selected.mimeType?.split('/')[1]?.toUpperCase() ?? '—'}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Hochgeladen</span>
                                <span class="font-medium text-foreground">{formatDate(selected.createdAt)}</span>
                            </div>
                        </div>

                        <div class="space-y-2 pt-1">
                            <Button size="sm" class="w-full gap-1.5" onclick={() => copyUrl(selected!)}>
                                {#if copied === selected.id}
                                    <Check class="w-3.5 h-3.5" /> Kopiert!
                                {:else}
                                    <Copy class="w-3.5 h-3.5" /> URL kopieren
                                {/if}
                            </Button>
                            <Button size="sm" variant="outline" class="w-full gap-1.5" href={selected.url} target="_blank">
                                <ExternalLink class="w-3.5 h-3.5" /> In neuem Tab öffnen
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                class="w-full gap-1.5"
                                disabled={deleting.has(selected.id)}
                                onclick={() => deleteFile(selected!)}
                            >
                                {#if deleting.has(selected.id)}
                                    <Loader2 class="w-3.5 h-3.5 animate-spin" />
                                {:else}
                                    <Trash2 class="w-3.5 h-3.5" /> Löschen
                                {/if}
                            </Button>
                        </div>
                    </div>
                </div>
            </aside>
        {/if}
    </div>
</PageContainer>
