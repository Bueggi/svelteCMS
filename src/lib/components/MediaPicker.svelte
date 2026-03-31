<script lang="ts">
    import { Upload, Images, X, Search, Loader2, Check } from '@lucide/svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';

    interface MediaFile {
        id: number;
        url: string;
        url400: string | null;
        url800: string | null;
        blurDataUrl: string | null;
        originalName: string | null;
        filename: string;
        width: number | null;
        height: number | null;
        size: number | null;
        mimeType: string | null;
    }

    let {
        value = $bindable(''),
        accept = 'image/*',
        uploading = $bindable(false),
        label = 'Bild hochladen',
        /** Optional aspect-ratio smart crop, e.g. "16:9" or "1:1" */
        cropRatio = '',
    }: {
        value?: string;
        accept?: string;
        uploading?: boolean;
        label?: string;
        cropRatio?: string;
    } = $props();

    let open = $state(false);
    let files = $state<MediaFile[]>([]);
    let page = $state(0);
    let hasMore = $state(false);
    let loading = $state(false);
    let query = $state('');
    let searchTimeout: ReturnType<typeof setTimeout>;

    async function loadFiles(reset = false) {
        if (reset) { page = 0; files = []; }
        loading = true;
        try {
            const params = new URLSearchParams({ page: String(reset ? 0 : page) });
            if (query) params.set('q', query);
            const res = await fetch(`/api/admin/media?${params}`);
            const data = await res.json();
            files = reset ? data.files : [...files, ...data.files];
            hasMore = data.hasMore;
            if (!reset) page++;
        } finally {
            loading = false;
        }
    }

    function openLibrary() {
        open = true;
        loadFiles(true);
    }

    function onSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => loadFiles(true), 300);
    }

    function select(url: string) {
        value = url;
        open = false;
    }

    async function handleUpload(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        uploading = true;
        try {
            const fd = new FormData();
            fd.append('file', file);
            const uploadUrl = cropRatio ? `/api/upload?crop=${encodeURIComponent(cropRatio)}` : '/api/upload';
            const res = await fetch(uploadUrl, { method: 'POST', body: fd });
            if (!res.ok) {
                let reason = `HTTP ${res.status}`;
                if (res.status === 413) {
                    reason = 'Datei zu groß für den Server (max. 20 MB). Bitte in einem externen Tool verkleinern.';
                } else {
                    try { const body = await res.json(); reason = body.message ?? body.error ?? reason; } catch {}
                }
                alert(`Upload fehlgeschlagen: ${reason}`);
                return;
            }
            const data = await res.json();
            value = data.url;
        } catch (err: any) {
            alert(`Upload fehlgeschlagen: ${err?.message ?? 'Netzwerkfehler'}`);
        } finally {
            uploading = false;
            (e.target as HTMLInputElement).value = '';
        }
    }
</script>

<!-- Inline upload + library trigger -->
<div class="space-y-2">
    {#if value}
        <div class="relative w-fit">
            <img
                src={value}
                alt="Vorschau"
                class="h-20 w-auto max-w-[280px] rounded-lg object-cover border border-border"
            />
            <button
                type="button"
                onclick={() => value = ''}
                class="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 transition-transform"
            >
                <X class="w-3 h-3" />
            </button>
        </div>
    {/if}

    <div class="flex gap-2 flex-wrap">
        <label class="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border cursor-pointer text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors {uploading ? 'opacity-60 pointer-events-none' : ''}">
            {#if uploading}
                <Loader2 class="w-4 h-4 animate-spin" />
            {:else}
                <Upload class="w-4 h-4" />
            {/if}
            {uploading ? 'Lädt hoch…' : label}
            <input type="file" {accept} class="sr-only" disabled={uploading} onchange={handleUpload} />
        </label>

        <Button type="button" variant="outline" size="sm" onclick={openLibrary} class="gap-1.5">
            <Images class="w-4 h-4" /> Mediathek
        </Button>
    </div>
</div>

<!-- Modal overlay -->
{#if open}
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    onclick={(e) => { if (e.target === e.currentTarget) open = false; }}
>
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

    <div class="relative z-10 bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h2 class="font-semibold">Mediathek</h2>
            <button type="button" onclick={() => open = false} class="text-muted-foreground hover:text-foreground transition-colors">
                <X class="w-5 h-5" />
            </button>
        </div>

        <!-- Search -->
        <div class="px-5 py-3 border-b border-border shrink-0">
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Dateiname suchen…"
                    bind:value={query}
                    oninput={onSearch}
                    class="pl-9"
                />
            </div>
        </div>

        <!-- Grid -->
        <div class="flex-1 overflow-y-auto p-5">
            {#if files.length === 0 && !loading}
                <div class="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                    <Images class="w-8 h-8 opacity-30" />
                    <span>Noch keine Bilder hochgeladen.</span>
                </div>
            {:else}
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {#each files as file}
                        <button
                            type="button"
                            onclick={() => select(file.url)}
                            class="group relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-[1.03] focus:outline-none focus:ring-2 focus:ring-primary {value === file.url ? 'border-primary' : 'border-transparent hover:border-primary/40'}"
                            title={file.originalName ?? file.filename}
                        >
                            <!-- Blur-up: show LQIP while thumbnail loads -->
                            <img
                                src={file.url400 ?? file.url}
                                alt={file.originalName ?? ''}
                                class="w-full h-full object-cover"
                                loading="lazy"
                                style={file.blurDataUrl ? `background-image:url("${file.blurDataUrl}");background-size:cover` : ''}
                            />
                            {#if value === file.url}
                                <div class="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <Check class="w-6 h-6 text-primary drop-shadow-sm" />
                                </div>
                            {/if}
                            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p class="text-[10px] text-white truncate">{file.originalName ?? file.filename}</p>
                            </div>
                        </button>
                    {/each}
                </div>
                {#if hasMore}
                    <div class="mt-4 flex justify-center">
                        <Button variant="outline" size="sm" onclick={() => loadFiles()} disabled={loading}>
                            {loading ? 'Lädt…' : 'Mehr laden'}
                        </Button>
                    </div>
                {/if}
            {/if}
            {#if loading && files.length === 0}
                <div class="flex items-center justify-center h-40">
                    <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            {/if}
        </div>
    </div>
</div>
{/if}
