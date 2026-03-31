<script lang="ts">
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { GripVertical, Plus, Trash2, ChevronDown, ChevronUp, Save, Lock } from 'lucide-svelte';
  import { untrack, tick } from 'svelte';
  import type { Block, BlockType } from './types';
  import { ALL_BLOCK_TYPES } from './types';
  import { createBlock, BLOCK_LABELS, BLOCK_VARIANTS } from './defaults';
  import { generateId } from '$lib/utils/uuid';
  import { toast } from 'svelte-sonner';

  const inp = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
  const addBtn = 'text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 py-1';

  let { blocks = [], context = 'landing', checkoutMode, onSave }: {
    blocks: Block[];
    context?: 'landing' | 'checkout' | 'thankyou';
    checkoutMode?: 'embedded' | 'separate';
    onSave: (json: string) => Promise<void>;
  } = $props();

  let items = $state<Block[]>(structuredClone(blocks));
  let openId = $state<string | null>(null);
  let showPicker = $state(false);
  let isSaving = $state(false);
  let pickerEl = $state<HTMLDivElement | null>(null);

  let editingBlock = $derived(items.find(b => b.id === openId) as any);

  // Enforce checkout block rules based on checkoutMode
  $effect(() => {
    const mode = checkoutMode;
    untrack(() => {
      if (mode === 'embedded') {
        if (!items.some(b => b.type === 'checkout')) {
          items = [...items, createBlock('checkout')];
        }
      } else if (mode === 'separate') {
        if (items.some(b => b.type === 'checkout')) {
          items = items.filter(b => b.type !== 'checkout');
        }
      }
    });
  });

  function handleConsider(e: CustomEvent<DndEvent<Block>>) { items = e.detail.items; }
  function handleFinalize(e: CustomEvent<DndEvent<Block>>) { items = e.detail.items; }
  function toggleOpen(id: string) { openId = openId === id ? null : id; }

  async function addBlock(type: BlockType) {
    const block = createBlock(type);
    items = [...items, block];
    openId = block.id;
    showPicker = false;
    await save();
  }

  function removeBlock(id: string) {
    items = items.filter(b => b.id !== id);
    if (openId === id) openId = null;
  }

  function update(key: string, value: any) {
    items = items.map(b => b.id === openId ? { ...b, [key]: value } : b);
  }

  function updateStyle(key: string, value: any) {
    const block = items.find(b => b.id === openId) as any;
    update('blockStyle', { ...(block?.blockStyle ?? {}), [key]: value });
  }

  function updateStyleMulti(patch: Record<string, any>) {
    const block = items.find(b => b.id === openId) as any;
    update('blockStyle', { ...(block?.blockStyle ?? {}), ...patch });
  }

  function updateItem(arrayKey: string, index: number, itemKey: string, value: any) {
    const block = items.find(b => b.id === openId) as any;
    update(arrayKey, block[arrayKey].map((item: any, i: number) =>
      i === index ? { ...item, [itemKey]: value } : item
    ));
  }

  function addItem(arrayKey: string, template: any) {
    const block = items.find(b => b.id === openId) as any;
    update(arrayKey, [...(block[arrayKey] ?? []), { id: generateId(), ...template }]);
  }

  function removeItem(arrayKey: string, index: number) {
    const block = items.find(b => b.id === openId) as any;
    update(arrayKey, block[arrayKey].filter((_: any, i: number) => i !== index));
  }

  async function save() {
    isSaving = true;
    try {
      await onSave(JSON.stringify(items));
      toast.success('Gespeichert!');
    } catch {
      toast.error('Fehler beim Speichern.');
    } finally {
      isSaving = false;
    }
  }

  function blockSummary(block: any): string {
    return block.headline ?? block.title ?? block.name ?? block.text ?? block.url ?? '';
  }

  function activeVariant(block: any): string {
    return block.variant ?? BLOCK_VARIANTS[block.type as BlockType]?.[0]?.id ?? '';
  }

  const FONT_WEIGHTS: Array<[string, string]> = [['light','Dünn'],['normal','Normal'],['medium','Medium'],['semibold','Halbfett'],['bold','Fett']];

  const HEADLINE_FONTS = [
    { name: 'Cormorant Garamond', family: 'Cormorant Garamond', cat: 'Serif' },
    { name: 'Playfair Display',   family: 'Playfair Display',   cat: 'Serif' },
    { name: 'Libre Baskerville',  family: 'Libre Baskerville',  cat: 'Serif' },
    { name: 'Lora',               family: 'Lora',               cat: 'Serif' },
    { name: 'Merriweather',       family: 'Merriweather',       cat: 'Serif' },
    { name: 'DM Serif Display',   family: 'DM Serif Display',   cat: 'Serif' },
    { name: 'Montserrat',         family: 'Montserrat',         cat: 'Sans-Serif' },
    { name: 'Raleway',            family: 'Raleway',            cat: 'Sans-Serif' },
    { name: 'Oswald',             family: 'Oswald',             cat: 'Sans-Serif' },
    { name: 'Poppins',            family: 'Poppins',            cat: 'Sans-Serif' },
    { name: 'Inter',              family: 'Inter',              cat: 'Sans-Serif' },
    { name: 'DM Sans',            family: 'DM Sans',            cat: 'Sans-Serif' },
  ];

  const BODY_FONTS = [
    { name: 'Inter',       family: 'Inter'       },
    { name: 'Montserrat',  family: 'Montserrat'  },
    { name: 'Raleway',     family: 'Raleway'     },
    { name: 'Poppins',     family: 'Poppins'     },
    { name: 'DM Sans',     family: 'DM Sans'     },
    { name: 'Lato',        family: 'Lato'        },
    { name: 'Nunito',      family: 'Nunito'      },
    { name: 'Open Sans',   family: 'Open Sans'   },
  ];

  const allFamilies = [...new Set([...HEADLINE_FONTS, ...BODY_FONTS].map(f => f.family))];
  const allFontsUrl = `https://fonts.googleapis.com/css2?${allFamilies.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&')}&display=swap`;
</script>

<svelte:head>
  <link rel="stylesheet" href={allFontsUrl} />
</svelte:head>

<!-- ── Shared input snippets ──────────────────────────────────────────── -->

{#snippet headlineInput(label: string, field: string, placeholder?: string)}
  <div class="space-y-1.5">
    <label class="text-xs font-medium text-foreground">{label}</label>
    <input class={inp} value={editingBlock[field] ?? ''} oninput={(e) => update(field, e.currentTarget.value)} placeholder={placeholder ?? ''} />
  </div>
{/snippet}

{#snippet buttonInput(label: string, field: string, placeholder?: string)}
  <div class="space-y-1.5">
    <label class="text-xs font-medium text-foreground">{label}</label>
    <input class={inp} value={editingBlock[field] ?? ''} oninput={(e) => update(field, e.currentTarget.value)} placeholder={placeholder ?? ''} />
  </div>
{/snippet}

<!-- ── Variant thumbnails ──────────────────────────────────────────────── -->

{#snippet variantThumb(type: BlockType, variantId: string)}
  {#if type === 'hero'}
    {#if variantId === 'centered'}
      <div class="flex flex-col items-center justify-center gap-1 h-full">
        <div class="h-1.5 w-10 bg-current rounded-full opacity-40"></div>
        <div class="h-1 w-7 bg-current rounded-full opacity-20"></div>
        <div class="h-2.5 w-8 bg-primary/50 rounded mt-1"></div>
      </div>
    {:else if variantId === 'left'}
      <div class="flex flex-col justify-center gap-1 h-full pl-2">
        <div class="h-1.5 w-10 bg-current rounded-full opacity-40"></div>
        <div class="h-1 w-7 bg-current rounded-full opacity-20"></div>
        <div class="h-2.5 w-6 bg-primary/50 rounded mt-1"></div>
      </div>
    {:else if variantId === 'split'}
      <div class="flex h-full gap-0.5">
        <div class="flex-1 flex flex-col justify-center gap-1 pl-1.5">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-1/2 bg-primary/50 rounded mt-0.5"></div>
        </div>
        <div class="w-7 bg-muted-foreground/20 rounded-r-sm shrink-0"></div>
      </div>
    {:else if variantId === 'fullscreen'}
      <div class="relative h-full w-full bg-muted-foreground/25 flex items-center justify-center">
        <div class="flex flex-col items-center gap-1">
          <div class="h-1.5 w-10 bg-white/80 rounded-full"></div>
          <div class="h-1 w-7 bg-white/50 rounded-full"></div>
          <div class="h-2.5 w-8 bg-primary/70 rounded mt-0.5"></div>
        </div>
      </div>
    {:else if variantId === 'minimal'}
      <div class="flex flex-col justify-start gap-1 h-full pt-2 pl-2">
        <div class="h-1.5 w-10 bg-current rounded-full opacity-40"></div>
        <div class="h-1 w-7 bg-current rounded-full opacity-20"></div>
      </div>
    {/if}

  {:else if type === 'features'}
    {#if variantId === 'grid'}
      <div class="flex items-end justify-center gap-1.5 h-full pb-2 pt-1 px-1">
        {#each [1,2,3] as _}<div class="flex-1 h-8 bg-muted-foreground/20 rounded border border-muted-foreground/10"></div>{/each}
      </div>
    {:else if variantId === 'list'}
      <div class="flex flex-col justify-center gap-1.5 h-full pl-1">
        {#each [1,2,3] as _}
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 bg-muted-foreground/25 rounded shrink-0"></div>
            <div class="flex-1 h-1 bg-current rounded-full opacity-20"></div>
          </div>
        {/each}
      </div>
    {:else if variantId === 'checkmarks'}
      <div class="flex flex-col justify-center gap-1.5 h-full pl-1">
        {#each [1,2,3] as _}
          <div class="flex items-center gap-1">
            <div class="w-2.5 h-2.5 border border-primary/50 rounded flex items-center justify-center shrink-0"><div class="w-1 h-1 bg-primary/60"></div></div>
            <div class="flex-1 h-1 bg-current rounded-full opacity-20"></div>
          </div>
        {/each}
      </div>
    {:else if variantId === 'numbered'}
      <div class="flex flex-col justify-center gap-1.5 h-full pl-1">
        {#each ['1','2','3'] as n}
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded-full bg-primary/30 flex items-center justify-center text-[6px] font-bold text-primary shrink-0">{n}</div>
            <div class="flex-1 h-1 bg-current rounded-full opacity-20"></div>
          </div>
        {/each}
      </div>
    {/if}

  {:else if type === 'testimonials'}
    {#if variantId === 'cards'}
      <div class="flex items-center justify-center gap-1 h-full px-1">
        {#each [1,2,3] as _}<div class="flex-1 h-8 bg-muted-foreground/15 rounded border border-muted-foreground/10"></div>{/each}
      </div>
    {:else if variantId === 'minimal'}
      <div class="flex flex-col items-center justify-center gap-1 h-full px-2">
        {#each [1,2,3] as _}<div class="h-1 w-full bg-current rounded-full opacity-15"></div>{/each}
        <div class="h-1.5 w-4 bg-muted-foreground/30 rounded-full mt-1"></div>
      </div>
    {:else if variantId === 'featured'}
      <div class="flex flex-col gap-1 h-full px-1 justify-center">
        <div class="h-6 bg-muted-foreground/15 rounded border border-muted-foreground/10 w-full"></div>
        <div class="flex gap-1"><div class="flex-1 h-3 bg-muted-foreground/10 rounded"></div><div class="flex-1 h-3 bg-muted-foreground/10 rounded"></div></div>
      </div>
    {/if}

  {:else if type === 'faq'}
    {#if variantId === 'accordion'}
      <div class="flex flex-col justify-center gap-1 h-full px-1">
        {#each [1,2,3] as _}
          <div class="flex items-center gap-1 border border-muted-foreground/20 rounded px-1 py-0.5">
            <div class="flex-1 h-1 bg-current rounded-full opacity-20"></div>
            <div class="text-[8px] text-muted-foreground/50 font-bold shrink-0">+</div>
          </div>
        {/each}
      </div>
    {:else if variantId === 'two-col'}
      <div class="flex gap-1 h-full items-center px-1">
        <div class="flex-1 flex flex-col gap-1">{#each [1,2] as _}<div class="border border-muted-foreground/20 rounded h-3"></div>{/each}</div>
        <div class="flex-1 flex flex-col gap-1">{#each [1,2] as _}<div class="border border-muted-foreground/20 rounded h-3"></div>{/each}</div>
      </div>
    {:else if variantId === 'cards'}
      <div class="flex flex-col justify-center gap-1 h-full px-1">
        {#each [1,2,3] as _}<div class="bg-muted-foreground/12 rounded h-3 border border-muted-foreground/10"></div>{/each}
      </div>
    {/if}

  {:else if type === 'richtext'}
    {#if variantId === 'default'}
      <div class="flex flex-col justify-center gap-1 h-full pl-2 pr-4">
        {#each [40,32,40,28] as w}<div class="h-1 bg-current rounded-full opacity-15" style="width:{w}px"></div>{/each}
      </div>
    {:else if variantId === 'centered'}
      <div class="flex flex-col items-center justify-center gap-1 h-full">
        {#each [40,32,40,28] as w}<div class="h-1 bg-current rounded-full opacity-15" style="width:{w}px"></div>{/each}
      </div>
    {:else if variantId === 'wide'}
      <div class="flex flex-col justify-center gap-1 h-full px-1">
        {#each [1,2,3,4] as _}<div class="h-1 w-full bg-current rounded-full opacity-15"></div>{/each}
      </div>
    {/if}

  {:else if type === 'cta'}
    {#if variantId === 'centered'}
      <div class="flex flex-col items-center justify-center gap-1.5 h-full">
        <div class="h-1.5 w-10 bg-current rounded-full opacity-40"></div>
        <div class="h-1 w-7 bg-current rounded-full opacity-20"></div>
        <div class="h-3 w-8 bg-primary/50 rounded mt-0.5"></div>
      </div>
    {:else if variantId === 'dark'}
      <div class="flex flex-col items-center justify-center gap-1.5 h-full bg-foreground/80 rounded">
        <div class="h-1.5 w-10 bg-white/70 rounded-full"></div>
        <div class="h-1 w-7 bg-white/40 rounded-full"></div>
        <div class="h-3 w-8 bg-primary/70 rounded mt-0.5"></div>
      </div>
    {:else if variantId === 'bordered'}
      <div class="flex flex-col items-center justify-center gap-1.5 h-full border-2 border-dashed border-muted-foreground/30 rounded m-1">
        <div class="h-1.5 w-10 bg-current rounded-full opacity-40"></div>
        <div class="h-3 w-8 bg-primary/50 rounded mt-0.5"></div>
      </div>
    {:else if variantId === 'minimal'}
      <div class="flex items-center justify-center h-full">
        <div class="h-4 w-14 bg-primary/50 rounded"></div>
      </div>
    {/if}

  {:else if type === 'instructor'}
    {#if variantId === 'horizontal'}
      <div class="flex items-center gap-2 h-full px-1">
        <div class="w-8 h-8 rounded-lg bg-muted-foreground/25 shrink-0"></div>
        <div class="flex flex-col gap-1 flex-1">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-1 w-1/2 bg-current rounded-full opacity-15"></div>
        </div>
      </div>
    {:else if variantId === 'centered'}
      <div class="flex flex-col items-center gap-1.5 h-full justify-center">
        <div class="w-8 h-8 rounded-full bg-muted-foreground/25"></div>
        <div class="h-1.5 w-10 bg-current rounded-full opacity-40"></div>
        <div class="h-1 w-8 bg-current rounded-full opacity-20"></div>
      </div>
    {:else if variantId === 'card'}
      <div class="m-1 border border-muted-foreground/20 rounded bg-muted/20 flex flex-col items-center gap-1 pt-1.5 h-[calc(100%-8px)]">
        <div class="w-7 h-7 rounded-full bg-muted-foreground/25"></div>
        <div class="h-1.5 w-9 bg-current rounded-full opacity-40"></div>
        <div class="h-1 w-7 bg-current rounded-full opacity-20"></div>
      </div>
    {/if}

  {:else if type === 'video'}
    {#if variantId === 'default'}
      <div class="flex items-center justify-center h-full px-3">
        <div class="w-full aspect-video bg-muted-foreground/20 rounded flex items-center justify-center">
          <div class="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-current opacity-30 ml-0.5"></div>
        </div>
      </div>
    {:else if variantId === 'fullwidth'}
      <div class="flex items-center justify-center h-full px-0.5">
        <div class="w-full aspect-video bg-muted-foreground/20 rounded flex items-center justify-center">
          <div class="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-current opacity-30 ml-0.5"></div>
        </div>
      </div>
    {:else if variantId === 'side-by-side'}
      <div class="flex items-center gap-1 h-full px-1">
        <div class="flex-1 aspect-video bg-muted-foreground/20 rounded"></div>
        <div class="flex-1 flex flex-col justify-center gap-1 pl-0.5">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
        </div>
      </div>
    {/if}

  {:else if type === 'guarantee'}
    {#if variantId === 'badge'}
      <div class="flex items-center h-full px-1">
        <div class="flex items-center gap-1 border border-green-500/40 bg-green-50/10 rounded-lg px-1.5 py-1">
          <div class="w-3 h-3 rounded bg-green-500/40 shrink-0"></div>
          <div class="flex flex-col gap-0.5">
            <div class="h-1 w-8 bg-current rounded-full opacity-30"></div>
            <div class="h-0.5 w-5 bg-current rounded-full opacity-20"></div>
          </div>
        </div>
      </div>
    {:else if variantId === 'banner'}
      <div class="flex items-center h-full">
        <div class="w-full bg-green-500/15 border-y border-green-500/25 flex items-center gap-1.5 px-2 py-2">
          <div class="w-3 h-3 rounded bg-green-500/40 shrink-0"></div>
          <div class="h-1 flex-1 bg-current rounded-full opacity-25"></div>
        </div>
      </div>
    {:else if variantId === 'centered'}
      <div class="flex flex-col items-center justify-center gap-1.5 h-full bg-green-50/10 border border-green-500/20 rounded m-1">
        <div class="w-6 h-6 rounded-full bg-green-500/25 flex items-center justify-center"><div class="w-2 h-2 rounded bg-green-500/50"></div></div>
        <div class="h-1 w-10 bg-current rounded-full opacity-30"></div>
        <div class="h-0.5 w-8 bg-current rounded-full opacity-20"></div>
      </div>
    {/if}

  {:else if type === 'bullets'}
    {#if variantId === 'checkmarks'}
      <div class="flex flex-col justify-center gap-1.5 h-full pl-1.5">
        {#each [1,2,3] as _}
          <div class="flex items-center gap-1"><div class="w-2.5 h-2.5 rounded bg-primary/35 shrink-0"></div><div class="flex-1 h-1 bg-current rounded-full opacity-20"></div></div>
        {/each}
      </div>
    {:else if variantId === 'numbered'}
      <div class="flex flex-col justify-center gap-1.5 h-full pl-1">
        {#each ['1','2','3'] as n}
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded-full border border-primary/40 flex items-center justify-center text-[6px] text-primary/60 font-bold shrink-0">{n}</div>
            <div class="flex-1 h-1 bg-current rounded-full opacity-20"></div>
          </div>
        {/each}
      </div>
    {:else if variantId === 'icons'}
      <div class="flex flex-col justify-center gap-1.5 h-full pl-1">
        {#each ['⭐','💎','✨'] as icon}
          <div class="flex items-center gap-1"><span class="text-[9px] shrink-0 leading-none">{icon}</span><div class="flex-1 h-1 bg-current rounded-full opacity-20"></div></div>
        {/each}
      </div>
    {:else if variantId === 'two-col'}
      <div class="flex gap-1 h-full items-center px-1">
        {#each [1,2] as _}
          <div class="flex-1 flex flex-col gap-1.5">
            {#each [1,2] as _}
              <div class="flex items-center gap-0.5"><div class="w-1.5 h-1.5 rounded bg-primary/35 shrink-0"></div><div class="flex-1 h-0.5 bg-current rounded-full opacity-20"></div></div>
            {/each}
          </div>
        {/each}
      </div>
    {/if}

  {:else if type === 'social_proof'}
    {#if variantId === 'inline'}
      <div class="flex items-center h-full pl-2 gap-2">
        <div class="flex gap-0.5">{#each [1,2,3,4,5] as _}<div class="w-1.5 h-1.5 bg-amber-400/60 rounded-sm"></div>{/each}</div>
        <div class="h-1 w-6 bg-current rounded-full opacity-20"></div>
      </div>
    {:else if variantId === 'centered'}
      <div class="flex flex-col items-center justify-center gap-1.5 h-full">
        <div class="flex gap-0.5">{#each [1,2,3,4,5] as _}<div class="w-2 h-2 bg-amber-400/60 rounded-sm"></div>{/each}</div>
        <div class="h-1 w-10 bg-current rounded-full opacity-25"></div>
      </div>
    {:else if variantId === 'cards'}
      <div class="flex items-center justify-center gap-1 h-full px-1">
        {#each [1,2,3] as _}
          <div class="flex-1 h-8 bg-muted-foreground/12 rounded border border-muted-foreground/10 flex flex-col items-center justify-center gap-0.5">
            <div class="h-1.5 w-4 bg-current rounded-full opacity-35"></div>
            <div class="h-0.5 w-3 bg-current rounded-full opacity-15"></div>
          </div>
        {/each}
      </div>
    {/if}

  {:else if type === 'urgency'}
    {#if variantId === 'banner'}
      <div class="flex items-center h-full">
        <div class="w-full bg-amber-500/25 border-y border-amber-500/35 flex items-center gap-1.5 px-2 py-2">
          <div class="w-2 h-2 rounded bg-amber-500/60 shrink-0"></div>
          <div class="h-1 flex-1 bg-current rounded-full opacity-25"></div>
        </div>
      </div>
    {:else if variantId === 'badge'}
      <div class="flex items-center justify-center h-full">
        <div class="bg-amber-500/15 border border-amber-500/35 rounded-full px-3 py-1 flex items-center gap-1">
          <div class="w-2 h-2 rounded bg-amber-500/60 shrink-0"></div>
          <div class="h-1 w-8 bg-current rounded-full opacity-25"></div>
        </div>
      </div>
    {:else if variantId === 'card'}
      <div class="m-1 bg-amber-500/15 border border-amber-500/25 rounded flex flex-col items-center justify-center gap-1 h-[calc(100%-8px)]">
        <div class="w-4 h-4 rounded bg-amber-500/50"></div>
        <div class="h-1 w-10 bg-current rounded-full opacity-25"></div>
      </div>
    {/if}

  {:else if type === 'image_text'}
    {#if variantId === 'image-left'}
      <div class="flex items-center gap-1 h-full px-1">
        <div class="w-7 h-full bg-muted-foreground/25 rounded-l-sm shrink-0"></div>
        <div class="flex-1 flex flex-col justify-center gap-1 pr-1">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-8 bg-primary/50 rounded mt-0.5"></div>
        </div>
      </div>
    {:else if variantId === 'image-right'}
      <div class="flex items-center gap-1 h-full px-1">
        <div class="flex-1 flex flex-col justify-center gap-1 pl-1">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-8 bg-primary/50 rounded mt-0.5"></div>
        </div>
        <div class="w-7 h-full bg-muted-foreground/25 rounded-r-sm shrink-0"></div>
      </div>
    {:else if variantId === 'image-large-left'}
      <div class="flex items-center gap-1 h-full px-0.5">
        <div class="w-10 h-full bg-muted-foreground/25 rounded-l-sm shrink-0"></div>
        <div class="flex-1 flex flex-col justify-center gap-1 pr-1">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-7 bg-primary/50 rounded mt-0.5"></div>
        </div>
      </div>
    {:else if variantId === 'image-large-right'}
      <div class="flex items-center gap-1 h-full px-0.5">
        <div class="flex-1 flex flex-col justify-center gap-1 pl-1">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-7 bg-primary/50 rounded mt-0.5"></div>
        </div>
        <div class="w-10 h-full bg-muted-foreground/25 rounded-r-sm shrink-0"></div>
      </div>
    {:else if variantId === 'image-cover-left'}
      <div class="flex h-full">
        <div class="w-1/2 h-full bg-muted-foreground/35 rounded-l-sm shrink-0"></div>
        <div class="flex-1 flex flex-col justify-center gap-1 pl-2 pr-1">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-8 bg-primary/50 rounded mt-0.5"></div>
        </div>
      </div>
    {:else if variantId === 'image-cover-right'}
      <div class="flex h-full">
        <div class="flex-1 flex flex-col justify-center gap-1 pl-1 pr-2">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-8 bg-primary/50 rounded mt-0.5"></div>
        </div>
        <div class="w-1/2 h-full bg-muted-foreground/35 rounded-r-sm shrink-0"></div>
      </div>
    {:else if variantId === 'image-top'}
      <div class="flex flex-col h-full">
        <div class="w-full h-5 bg-muted-foreground/25 shrink-0"></div>
        <div class="flex-1 flex flex-col justify-center items-center gap-1 px-2">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-2 w-8 bg-primary/50 rounded mt-0.5"></div>
        </div>
      </div>
    {:else if variantId === 'image-sticky'}
      <div class="flex items-start gap-1 h-full px-1 pt-1">
        <div class="w-7 h-8 bg-muted-foreground/25 rounded shrink-0"><div class="w-full h-0.5 bg-primary/40 rounded-t"></div></div>
        <div class="flex-1 flex flex-col gap-1 pr-1">
          <div class="h-1.5 w-full bg-current rounded-full opacity-40"></div>
          <div class="h-1 w-3/4 bg-current rounded-full opacity-20"></div>
          <div class="h-1 w-full bg-current rounded-full opacity-15"></div>
          <div class="h-2 w-7 bg-primary/50 rounded mt-0.5"></div>
        </div>
      </div>
    {/if}

  {:else if type === 'checkout'}
    {#if variantId === 'default'}
      <div class="flex flex-col justify-center gap-1.5 h-full px-2">
        <div class="space-y-1">
          {#each [1,2] as _}
            <div class="border border-dashed border-muted-foreground/30 rounded h-4 flex items-center px-1.5 gap-1">
              <div class="w-2 h-2 border border-muted-foreground/30 rounded shrink-0"></div>
              <div class="h-0.5 flex-1 bg-current rounded-full opacity-15"></div>
            </div>
          {/each}
        </div>
        <div class="h-4 w-full bg-primary/50 rounded mt-0.5"></div>
      </div>
    {:else if variantId === 'split'}
      <div class="flex gap-1 h-full px-1 items-center">
        <div class="flex-1 flex flex-col gap-1">
          {#each [1,2] as _}
            <div class="border border-dashed border-muted-foreground/30 rounded h-3"></div>
          {/each}
        </div>
        <div class="w-9 bg-muted/30 border border-border/40 rounded flex flex-col gap-1 p-1 h-full justify-center">
          <div class="h-0.5 w-full bg-current rounded-full opacity-20"></div>
          <div class="h-3 w-full bg-primary/50 rounded"></div>
        </div>
      </div>
    {:else if variantId === 'minimal'}
      <div class="flex items-center justify-center h-full">
        <div class="h-5 w-16 bg-primary/50 rounded flex items-center justify-center gap-0.5">
          <div class="w-2 h-2 bg-white/60 rounded-sm"></div>
          <div class="h-0.5 w-6 bg-white/60 rounded-full"></div>
        </div>
      </div>
    {/if}
  {/if}
{/snippet}

<!-- ── Main UI ──────────────────────────────────────────────────────────── -->

<div class="flex flex-col h-full">
  <!-- Toolbar -->
  <div class="flex items-center justify-between px-6 py-3 border-b bg-background sticky top-0 z-10">
    <span class="text-sm text-muted-foreground">{items.length} {items.length === 1 ? 'Block' : 'Blöcke'}</span>
    <button
      onclick={save}
      disabled={isSaving}
      class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      <Save class="w-4 h-4" />
      {isSaving ? 'Speichern...' : 'Speichern'}
    </button>
  </div>

  <div class="flex-1 overflow-y-auto p-4 space-y-2">
    {#if items.length > 0}
      <div use:dndzone={{ items, flipDurationMs: 200 }} onconsider={handleConsider} onfinalize={handleFinalize} class="space-y-2">
        {#each items as block (block.id)}
          {@const isLockedCheckout = block.type === 'checkout' && checkoutMode === 'embedded'}
          <div class="border border-border/60 rounded-xl bg-card overflow-hidden">
            <div class="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-muted/30 transition-colors" onclick={() => toggleOpen(block.id)}>
              {#if isLockedCheckout}
                <Lock class="w-4 h-4 text-muted-foreground/40 shrink-0" />
              {:else}
                <GripVertical class="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
              {/if}
              <span class="text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">{BLOCK_LABELS[block.type]}</span>
              <span class="text-sm text-muted-foreground truncate flex-1">{blockSummary(block)}</span>
              {#if isLockedCheckout}
                <span class="text-xs text-muted-foreground/50 shrink-0 px-2">Pflichtblock</span>
              {:else}
                <button onclick={(e) => { e.stopPropagation(); removeBlock(block.id); }} class="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded">
                  <Trash2 class="w-4 h-4" />
                </button>
              {/if}
              {#if openId === block.id}
                <ChevronUp class="w-4 h-4 text-muted-foreground shrink-0" />
              {:else}
                <ChevronDown class="w-4 h-4 text-muted-foreground shrink-0" />
              {/if}
            </div>

            <!-- Expanded panel -->
            {#if openId === block.id && editingBlock}
              <div class="border-t border-border/50 p-4 space-y-4 bg-muted/20">

                <!-- Variant picker -->
                {#if BLOCK_VARIANTS[editingBlock.type]?.length > 1}
                  <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Variante</p>
                    <div class="flex gap-2 flex-wrap">
                      {#each BLOCK_VARIANTS[editingBlock.type] as v}
                        <button onclick={() => update('variant', v.id)} class="flex flex-col items-center gap-1">
                          <div class="w-[72px] h-[48px] rounded-md border overflow-hidden transition-all
                            {activeVariant(editingBlock) === v.id ? 'border-primary ring-2 ring-primary/30' : 'border-border/50 hover:border-primary/40'}">
                            {@render variantThumb(editingBlock.type, v.id)}
                          </div>
                          <span class="text-[10px] {activeVariant(editingBlock) === v.id ? 'text-primary font-medium' : 'text-muted-foreground'}">{v.label}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- ── Type-specific fields ── -->

                {#if editingBlock.type === 'hero'}
                  {@render headlineInput('Headline *', 'headline')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Subheadline</label>
                    <textarea class={inp} rows="2" value={editingBlock.subheadline ?? ''} oninput={(e) => update('subheadline', e.currentTarget.value)}></textarea>
                  </div>
                  {#if editingBlock.variant !== 'minimal'}
                    <div class="space-y-1.5">
                      <label class="text-xs font-medium text-foreground">Bild-URL</label>
                      <input type="url" class={inp} value={editingBlock.imageUrl ?? ''} oninput={(e) => update('imageUrl', e.currentTarget.value)} placeholder="https://..." />
                    </div>
                    {@render buttonInput('Button-Text', 'ctaText', 'Jetzt kaufen')}
                  {/if}

                {:else if editingBlock.type === 'features'}
                  {@render headlineInput('Titel', 'title', 'Was du lernen wirst')}
                  <div class="space-y-2">
                    <label class="text-xs font-medium text-foreground uppercase tracking-wider">Einträge</label>
                    {#each editingBlock.items ?? [] as item, i}
                      <div class="grid grid-cols-[40px_1fr_1fr_auto] gap-2 items-start p-3 bg-background rounded-lg border border-border/50">
                        <input class="{inp} text-center text-lg" value={item.icon ?? ''} oninput={(e) => updateItem('items', i, 'icon', e.currentTarget.value)} placeholder="✨" />
                        <input class={inp} value={item.title} oninput={(e) => updateItem('items', i, 'title', e.currentTarget.value)} placeholder="Titel" />
                        <input class={inp} value={item.description ?? ''} oninput={(e) => updateItem('items', i, 'description', e.currentTarget.value)} placeholder="Beschreibung" />
                        <button onclick={() => removeItem('items', i)} class="text-muted-foreground/40 hover:text-destructive p-1.5 mt-0.5"><Trash2 class="w-3.5 h-3.5" /></button>
                      </div>
                    {/each}
                    <button onclick={() => addItem('items', { icon: '⭐', title: 'Neuer Eintrag', description: '' })} class={addBtn}>+ Eintrag hinzufügen</button>
                  </div>

                {:else if editingBlock.type === 'testimonials'}
                  {@render headlineInput('Titel', 'title', 'Das sagen Teilnehmerinnen')}
                  <div class="space-y-2">
                    <label class="text-xs font-medium text-foreground uppercase tracking-wider">Bewertungen</label>
                    {#each editingBlock.items ?? [] as item, i}
                      <div class="space-y-2 p-3 bg-background rounded-lg border border-border/50">
                        <div class="grid grid-cols-2 gap-2">
                          <input class={inp} value={item.name} oninput={(e) => updateItem('items', i, 'name', e.currentTarget.value)} placeholder="Name" />
                          <input class={inp} value={item.role ?? ''} oninput={(e) => updateItem('items', i, 'role', e.currentTarget.value)} placeholder="Rolle" />
                        </div>
                        <textarea class={inp} rows="2" value={item.text} oninput={(e) => updateItem('items', i, 'text', e.currentTarget.value)} placeholder="Bewertungstext"></textarea>
                        <div class="flex items-center gap-2">
                          <input class={inp} value={item.avatarUrl ?? ''} oninput={(e) => updateItem('items', i, 'avatarUrl', e.currentTarget.value)} placeholder="Foto-URL" />
                          <select class="{inp} w-28 shrink-0" value={item.rating ?? 5} onchange={(e) => updateItem('items', i, 'rating', parseInt(e.currentTarget.value))}>
                            {#each [5,4,3,2,1] as r}<option value={r}>{r} ★</option>{/each}
                          </select>
                          <button onclick={() => removeItem('items', i)} class="text-muted-foreground/40 hover:text-destructive p-1.5 shrink-0"><Trash2 class="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    {/each}
                    <button onclick={() => addItem('items', { name: 'Name', role: '', text: 'Bewertungstext...', rating: 5 })} class={addBtn}>+ Bewertung hinzufügen</button>
                  </div>

                {:else if editingBlock.type === 'faq'}
                  {@render headlineInput('Titel', 'title', 'Häufige Fragen')}
                  <div class="space-y-2">
                    <label class="text-xs font-medium text-foreground uppercase tracking-wider">Fragen</label>
                    {#each editingBlock.items ?? [] as item, i}
                      <div class="space-y-2 p-3 bg-background rounded-lg border border-border/50">
                        <div class="flex gap-2">
                          <input class={inp} value={item.question} oninput={(e) => updateItem('items', i, 'question', e.currentTarget.value)} placeholder="Frage?" />
                          <button onclick={() => removeItem('items', i)} class="text-muted-foreground/40 hover:text-destructive p-1.5 shrink-0"><Trash2 class="w-3.5 h-3.5" /></button>
                        </div>
                        <textarea class={inp} rows="2" value={item.answer} oninput={(e) => updateItem('items', i, 'answer', e.currentTarget.value)} placeholder="Antwort..."></textarea>
                      </div>
                    {/each}
                    <button onclick={() => addItem('items', { question: 'Neue Frage?', answer: 'Antwort...' })} class={addBtn}>+ Frage hinzufügen</button>
                  </div>

                {:else if editingBlock.type === 'richtext'}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Inhalt (HTML)</label>
                    <textarea class="{inp} font-mono text-xs" rows="8" value={editingBlock.content} oninput={(e) => update('content', e.currentTarget.value)} placeholder="<p>Dein Text hier...</p>"></textarea>
                    <p class="text-xs text-muted-foreground">HTML: &lt;strong&gt;, &lt;em&gt;, &lt;ul&gt;&lt;li&gt;…&lt;/li&gt;&lt;/ul&gt;</p>
                  </div>

                {:else if editingBlock.type === 'cta'}
                  {@render headlineInput('Headline', 'headline', 'Bereit für den nächsten Schritt?')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Subtext</label>
                    <input class={inp} value={editingBlock.subtext ?? ''} oninput={(e) => update('subtext', e.currentTarget.value)} placeholder="Tritt noch heute bei" />
                  </div>
                  {@render buttonInput('Button-Text', 'buttonText', 'Jetzt kaufen')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Garantie-Text</label>
                    <input class={inp} value={editingBlock.guaranteeText ?? ''} oninput={(e) => update('guaranteeText', e.currentTarget.value)} placeholder="30 Tage Geld-zurück-Garantie" />
                  </div>

                {:else if editingBlock.type === 'instructor'}
                  {@render headlineInput('Name', 'name')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Bio</label>
                    <textarea class={inp} rows="3" value={editingBlock.bio} oninput={(e) => update('bio', e.currentTarget.value)}></textarea>
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Foto-URL</label>
                    <input type="url" class={inp} value={editingBlock.imageUrl ?? ''} oninput={(e) => update('imageUrl', e.currentTarget.value)} placeholder="https://..." />
                  </div>
                  <div class="space-y-2">
                    <label class="text-xs font-medium text-foreground uppercase tracking-wider">Qualifikationen</label>
                    {#each editingBlock.credentials ?? [] as cred, i}
                      <div class="flex gap-2">
                        <input class={inp} value={cred} oninput={(e) => {
                          const c = [...editingBlock.credentials]; c[i] = e.currentTarget.value; update('credentials', c);
                        }} placeholder="Zertifizierung / Abschluss" />
                        <button onclick={() => update('credentials', editingBlock.credentials.filter((_: any, idx: number) => idx !== i))} class="text-muted-foreground/40 hover:text-destructive p-1.5 shrink-0"><Trash2 class="w-3.5 h-3.5" /></button>
                      </div>
                    {/each}
                    <button onclick={() => update('credentials', [...(editingBlock.credentials ?? []), ''])} class={addBtn}>+ Qualifikation hinzufügen</button>
                  </div>

                {:else if editingBlock.type === 'video'}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Video-URL (YouTube / Vimeo)</label>
                    <input type="url" class={inp} value={editingBlock.url} oninput={(e) => update('url', e.currentTarget.value)} placeholder="https://www.youtube.com/watch?v=..." />
                  </div>
                  {@render headlineInput('Titel', 'title')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Beschreibung</label>
                    <textarea class={inp} rows="2" value={editingBlock.description ?? ''} oninput={(e) => update('description', e.currentTarget.value)}></textarea>
                  </div>

                {:else if editingBlock.type === 'guarantee'}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Tage</label>
                    <input type="number" class={inp} value={editingBlock.days} oninput={(e) => update('days', parseInt(e.currentTarget.value))} min="1" />
                  </div>
                  {@render headlineInput('Headline', 'headline')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Text</label>
                    <textarea class={inp} rows="2" value={editingBlock.text ?? ''} oninput={(e) => update('text', e.currentTarget.value)}></textarea>
                  </div>

                {:else if editingBlock.type === 'bullets'}
                  {@render headlineInput('Titel', 'title', 'Inklusive im Kurs')}
                  <div class="space-y-2">
                    <label class="text-xs font-medium text-foreground uppercase tracking-wider">Punkte</label>
                    {#each editingBlock.items ?? [] as item, i}
                      <div class="flex gap-2">
                        <input class={inp} value={item} oninput={(e) => {
                          const it = [...editingBlock.items]; it[i] = e.currentTarget.value; update('items', it);
                        }} placeholder="Leistungspunkt..." />
                        <button onclick={() => update('items', editingBlock.items.filter((_: any, idx: number) => idx !== i))} class="text-muted-foreground/40 hover:text-destructive p-1.5 shrink-0"><Trash2 class="w-3.5 h-3.5" /></button>
                      </div>
                    {/each}
                    <button onclick={() => update('items', [...(editingBlock.items ?? []), ''])} class={addBtn}>+ Punkt hinzufügen</button>
                  </div>

                {:else if editingBlock.type === 'social_proof'}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Anzahl Teilnehmer</label>
                    <input type="number" class={inp} value={editingBlock.count ?? 0} oninput={(e) => update('count', parseInt(e.currentTarget.value))} />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Text</label>
                    <input class={inp} value={editingBlock.text ?? ''} oninput={(e) => update('text', e.currentTarget.value)} placeholder="Teilnehmerinnen vertrauen uns" />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Bewertung (z.B. 4.9)</label>
                    <input type="number" step="0.1" min="1" max="5" class={inp} value={editingBlock.rating ?? 5} oninput={(e) => update('rating', parseFloat(e.currentTarget.value))} />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Anzahl Bewertungen</label>
                    <input type="number" class={inp} value={editingBlock.reviewCount ?? 0} oninput={(e) => update('reviewCount', parseInt(e.currentTarget.value))} />
                  </div>

                {:else if editingBlock.type === 'urgency'}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Haupttext</label>
                    <input class={inp} value={editingBlock.text} oninput={(e) => update('text', e.currentTarget.value)} placeholder="Nur noch heute zum Einführungspreis!" />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Subtext</label>
                    <input class={inp} value={editingBlock.subtext ?? ''} oninput={(e) => update('subtext', e.currentTarget.value)} />
                  </div>

                {:else if editingBlock.type === 'checkout'}
                  <div class="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1">
                    <p class="font-semibold text-foreground text-sm">📦 Eingebetteter Checkout</p>
                    <p>Dieses Modul zeigt das Bestellformular direkt auf der Landingpage – inkl. Upsells, Gutscheincode und Stripe-Zahlung. Keine separate Checkout-Seite nötig.</p>
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Überschrift (optional)</label>
                    <input class={inp} value={editingBlock.headline ?? ''} oninput={(e) => update('headline', e.currentTarget.value)} placeholder="Jetzt starten" />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Subtext (optional)</label>
                    <input class={inp} value={editingBlock.subtext ?? ''} oninput={(e) => update('subtext', e.currentTarget.value)} placeholder="30 Tage Geld-zurück-Garantie" />
                  </div>

                {:else if editingBlock.type === 'image_text'}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Bild-URL *</label>
                    <input type="url" class={inp} value={editingBlock.imageUrl ?? ''} oninput={(e) => update('imageUrl', e.currentTarget.value)} placeholder="https://..." />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Bild Alt-Text</label>
                    <input class={inp} value={editingBlock.imageAlt ?? ''} oninput={(e) => update('imageAlt', e.currentTarget.value)} placeholder="Bildbeschreibung für Barrierefreiheit" />
                  </div>
                  {@render headlineInput('Headline', 'headline', 'Deine Überschrift')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Subheadline</label>
                    <input class={inp} value={editingBlock.subheadline ?? ''} oninput={(e) => update('subheadline', e.currentTarget.value)} placeholder="Untertitel (optional)" />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Text (HTML)</label>
                    <textarea class="{inp} font-mono text-xs" rows="4" value={editingBlock.body ?? ''} oninput={(e) => update('body', e.currentTarget.value)} placeholder="<p>Beschreibe hier...</p>"></textarea>
                  </div>
                  {@render buttonInput('Button-Text', 'ctaText', 'Jetzt kaufen (leer = kein Button)')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Button-URL</label>
                    <input type="url" class={inp} value={editingBlock.ctaUrl ?? ''} oninput={(e) => update('ctaUrl', e.currentTarget.value)} placeholder="https://... (leer = Kurs-Checkout)" />
                  </div>

                {:else if editingBlock.type === 'order_summary'}
                  <div class="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-xs text-muted-foreground space-y-1">
                    <p class="font-semibold text-foreground text-sm">🎉 Bestellübersicht (dynamisch)</p>
                    <p>Zeigt den gekauften Kurs mit Thumbnail, Titel und bezahltem Betrag an. Die Daten werden automatisch aus der Bestellung befüllt.</p>
                  </div>
                  {@render headlineInput('Headline', 'headline', 'Vielen Dank für deinen Kauf!')}
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Subtext</label>
                    <input class={inp} value={editingBlock.subtext ?? ''} oninput={(e) => update('subtext', e.currentTarget.value)} placeholder="Du hast sofortigen Zugang zu deinem Kurs." />
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Button-Text</label>
                    <input class={inp} value={editingBlock.ctaText ?? ''} oninput={(e) => update('ctaText', e.currentTarget.value)} placeholder="Jetzt zum Kurs" />
                  </div>
                {/if}

                <!-- ── Typografie ── -->
                <div class="border-t border-border/30 pt-4 space-y-3">
                  <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typografie</p>

                  <!-- Überschriften -->
                  <div class="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2.5">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Überschriften</p>
                    <div class="flex items-center gap-2">
                      <div class="relative w-6 h-6 shrink-0 rounded border border-border overflow-hidden">
                        <div class="w-full h-full pointer-events-none" style="background:{editingBlock.blockStyle?.headlineColor ?? '#111111'}"></div>
                        <input type="color" value={editingBlock.blockStyle?.headlineColor ?? '#111111'} oninput={(e) => updateStyle('headlineColor', e.currentTarget.value)} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                      </div>
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Farbe</span>
                      <input class="{inp} flex-1 font-mono text-xs" value={editingBlock.blockStyle?.headlineColor ?? ''} oninput={(e) => updateStyle('headlineColor', e.currentTarget.value || undefined)} placeholder="Standard" />
                      {#if editingBlock.blockStyle?.headlineColor}
                        <button onclick={() => updateStyle('headlineColor', undefined)} class="text-xs text-muted-foreground/40 hover:text-destructive shrink-0">↺</button>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Schriftstärke</span>
                      <div class="flex gap-1 flex-1">
                        {#each FONT_WEIGHTS as [val, lbl]}
                          <button onclick={() => updateStyle('headlineFontWeight', editingBlock.blockStyle?.headlineFontWeight === val ? undefined : val)}
                            class="flex-1 text-[11px] py-1 rounded border transition-colors {editingBlock.blockStyle?.headlineFontWeight === val ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border/40 text-muted-foreground hover:border-primary/40'}"
                          >{lbl}</button>
                        {/each}
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Schriftart</span>
                      <select class="{inp} flex-1 text-xs" value={editingBlock.blockStyle?.headlineFont ?? ''} onchange={(e) => updateStyle('headlineFont', e.currentTarget.value || undefined)}>
                        <option value="">Standard</option>
                        <optgroup label="Serif">
                          {#each HEADLINE_FONTS.filter(f => f.cat === 'Serif') as f}
                            <option value={f.family} style="font-family: '{f.family}'">{f.name}</option>
                          {/each}
                        </optgroup>
                        <optgroup label="Sans-Serif">
                          {#each HEADLINE_FONTS.filter(f => f.cat === 'Sans-Serif') as f}
                            <option value={f.family} style="font-family: '{f.family}'">{f.name}</option>
                          {/each}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <!-- Fließtext & Subheadlines -->
                  <div class="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2.5">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Fließtext & Subheadlines</p>
                    <div class="flex items-center gap-2">
                      <div class="relative w-6 h-6 shrink-0 rounded border border-border overflow-hidden">
                        <div class="w-full h-full pointer-events-none" style="background:{editingBlock.blockStyle?.textColor ?? '#555555'}"></div>
                        <input type="color" value={editingBlock.blockStyle?.textColor ?? '#555555'} oninput={(e) => updateStyle('textColor', e.currentTarget.value)} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                      </div>
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Farbe</span>
                      <input class="{inp} flex-1 font-mono text-xs" value={editingBlock.blockStyle?.textColor ?? ''} oninput={(e) => updateStyle('textColor', e.currentTarget.value || undefined)} placeholder="Standard" />
                      {#if editingBlock.blockStyle?.textColor}
                        <button onclick={() => updateStyle('textColor', undefined)} class="text-xs text-muted-foreground/40 hover:text-destructive shrink-0">↺</button>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Schriftstärke</span>
                      <div class="flex gap-1 flex-1">
                        {#each [['light','Dünn'],['normal','Normal'],['medium','Mittel']] as [val, lbl]}
                          <button onclick={() => updateStyle('bodyFontWeight', editingBlock.blockStyle?.bodyFontWeight === val ? undefined : val)}
                            class="flex-1 text-xs py-1 rounded border transition-colors {editingBlock.blockStyle?.bodyFontWeight === val ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border/40 text-muted-foreground hover:border-primary/40'}"
                          >{lbl}</button>
                        {/each}
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Schriftart</span>
                      <select class="{inp} flex-1 text-xs" value={editingBlock.blockStyle?.bodyFont ?? ''} onchange={(e) => updateStyle('bodyFont', e.currentTarget.value || undefined)}>
                        <option value="">Standard (Inter)</option>
                        {#each BODY_FONTS as f}
                          <option value={f.family} style="font-family: '{f.family}'">{f.name}</option>
                        {/each}
                      </select>
                    </div>
                  </div>

                  <!-- Buttons -->
                  <div class="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2.5">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Buttons</p>
                    <div class="flex items-center gap-2">
                      <div class="relative w-6 h-6 shrink-0 rounded border border-border overflow-hidden">
                        <div class="w-full h-full pointer-events-none" style="background:{editingBlock.blockStyle?.buttonBgColor ?? '#000000'}"></div>
                        <input type="color" value={editingBlock.blockStyle?.buttonBgColor ?? '#000000'} oninput={(e) => updateStyle('buttonBgColor', e.currentTarget.value)} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                      </div>
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Hintergrund</span>
                      <input class="{inp} flex-1 font-mono text-xs" value={editingBlock.blockStyle?.buttonBgColor ?? ''} oninput={(e) => updateStyle('buttonBgColor', e.currentTarget.value || undefined)} placeholder="Standard" />
                      {#if editingBlock.blockStyle?.buttonBgColor}
                        <button onclick={() => updateStyle('buttonBgColor', undefined)} class="text-xs text-muted-foreground/40 hover:text-destructive shrink-0">↺</button>
                      {/if}
                    </div>
                    <div class="flex items-center gap-2">
                      <div class="relative w-6 h-6 shrink-0 rounded border border-border overflow-hidden">
                        <div class="w-full h-full pointer-events-none" style="background:{editingBlock.blockStyle?.buttonTextColor ?? '#ffffff'}"></div>
                        <input type="color" value={editingBlock.blockStyle?.buttonTextColor ?? '#ffffff'} oninput={(e) => updateStyle('buttonTextColor', e.currentTarget.value)} class="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                      </div>
                      <span class="text-xs text-muted-foreground min-w-[5.5rem] shrink-0">Schriftfarbe</span>
                      <input class="{inp} flex-1 font-mono text-xs" value={editingBlock.blockStyle?.buttonTextColor ?? ''} oninput={(e) => updateStyle('buttonTextColor', e.currentTarget.value || undefined)} placeholder="Standard" />
                      {#if editingBlock.blockStyle?.buttonTextColor}
                        <button onclick={() => updateStyle('buttonTextColor', undefined)} class="text-xs text-muted-foreground/40 hover:text-destructive shrink-0">↺</button>
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- ── Hintergrund & Stil ── -->
                <div class="border-t border-border/30 pt-4 space-y-3">
                  <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hintergrund & Stil</p>

                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Hintergrund</label>
                    <div class="flex gap-1.5">
                      {#each [['none','Keiner'],['color','Farbe'],['gradient','Verlauf'],['image','Bild']] as [val, lbl]}
                        <button
                          onclick={() => updateStyle('bgType', val)}
                          class="flex-1 text-xs py-1.5 rounded border transition-colors
                            {editingBlock.blockStyle?.bgType === val
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border/50 text-muted-foreground hover:border-primary/40'}"
                        >{lbl}</button>
                      {/each}
                    </div>
                  </div>

                  {#if editingBlock.blockStyle?.bgType === 'color'}
                    <div class="flex items-center gap-2">
                      <input type="color" value={editingBlock.blockStyle.bgColor ?? '#ffffff'} oninput={(e) => updateStyle('bgColor', e.currentTarget.value)} class="w-8 h-8 rounded cursor-pointer border border-border shrink-0" />
                      <input class="{inp} flex-1" value={editingBlock.blockStyle.bgColor ?? ''} oninput={(e) => updateStyle('bgColor', e.currentTarget.value)} placeholder="#ffffff" />
                    </div>
                  {/if}

                  {#if editingBlock.blockStyle?.bgType === 'gradient'}
                    <div class="space-y-2">
                      <div class="grid grid-cols-2 gap-2">
                        <div class="space-y-1">
                          <label class="text-xs text-muted-foreground">Von</label>
                          <div class="flex items-center gap-1">
                            <input type="color" value={editingBlock.blockStyle.bgGradientFrom ?? '#ffffff'} oninput={(e) => updateStyle('bgGradientFrom', e.currentTarget.value)} class="w-7 h-7 rounded cursor-pointer border border-border shrink-0" />
                            <input class={inp} value={editingBlock.blockStyle.bgGradientFrom ?? ''} oninput={(e) => updateStyle('bgGradientFrom', e.currentTarget.value)} placeholder="#ffffff" />
                          </div>
                        </div>
                        <div class="space-y-1">
                          <label class="text-xs text-muted-foreground">Bis</label>
                          <div class="flex items-center gap-1">
                            <input type="color" value={editingBlock.blockStyle.bgGradientTo ?? '#000000'} oninput={(e) => updateStyle('bgGradientTo', e.currentTarget.value)} class="w-7 h-7 rounded cursor-pointer border border-border shrink-0" />
                            <input class={inp} value={editingBlock.blockStyle.bgGradientTo ?? ''} oninput={(e) => updateStyle('bgGradientTo', e.currentTarget.value)} placeholder="#000000" />
                          </div>
                        </div>
                      </div>
                      <select class={inp} value={editingBlock.blockStyle.bgGradientDir ?? 'to-bottom'} onchange={(e) => updateStyle('bgGradientDir', e.currentTarget.value)}>
                        <option value="to-bottom">↓ Nach unten</option>
                        <option value="to-right">→ Nach rechts</option>
                        <option value="to-bottom-right">↘ Diagonal rechts</option>
                        <option value="to-bottom-left">↙ Diagonal links</option>
                      </select>
                    </div>
                  {/if}

                  {#if editingBlock.blockStyle?.bgType === 'image'}
                    <div class="space-y-2">
                      <input type="url" class={inp} value={editingBlock.blockStyle.bgImage ?? ''} oninput={(e) => updateStyle('bgImage', e.currentTarget.value)} placeholder="https://..." />
                      <div class="space-y-1">
                        <label class="text-xs text-muted-foreground">Overlay: {Math.round((editingBlock.blockStyle.bgImageOverlay ?? 0.3) * 100)}%</label>
                        <input type="range" min="0" max="0.9" step="0.05" value={editingBlock.blockStyle.bgImageOverlay ?? 0.3} oninput={(e) => updateStyle('bgImageOverlay', parseFloat(e.currentTarget.value))} class="w-full accent-primary" />
                      </div>
                    </div>
                  {/if}

                  <!-- Innenabstand -->
                  <div class="space-y-1.5">
                    <label class="text-xs font-medium text-foreground">Innenabstand</label>
                    <div class="flex gap-1.5">
                      {#each [['sm','Klein'],['md','Mittel'],['lg','Groß'],['xl','Extra']] as [val, lbl]}
                        <button
                          onclick={() => updateStyle('padding', editingBlock.blockStyle?.padding === val ? undefined : val)}
                          class="flex-1 text-xs py-1.5 rounded border transition-colors
                            {editingBlock.blockStyle?.padding === val
                              ? 'border-primary bg-primary/10 text-primary font-medium'
                              : 'border-border/50 text-muted-foreground hover:border-primary/40'}"
                        >{lbl}</button>
                      {/each}
                    </div>
                  </div>
                </div>

              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-center py-16 text-muted-foreground">
        <p class="text-lg font-medium">Noch keine Blöcke vorhanden</p>
        <p class="text-sm mt-1">Füge deinen ersten Block hinzu, um die Seite zu gestalten.</p>
      </div>
    {/if}

    <button
      type="button"
      onclick={async () => {
        showPicker = !showPicker;
        if (showPicker) {
          await tick();
          pickerEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }}
      class="w-full border-2 border-dashed border-border/50 hover:border-primary/40 rounded-xl py-4 text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2"
    >
      <Plus class="w-4 h-4" />
      Block hinzufügen
    </button>

    {#if showPicker}
      <div bind:this={pickerEl} class="border border-border/60 rounded-xl p-4 bg-card">
        <p class="text-sm font-medium mb-3 text-foreground">Block-Typ wählen:</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {#each ALL_BLOCK_TYPES.filter(t => {
            if (t === 'checkout' && checkoutMode === 'separate') return false;
            if (t === 'checkout' && checkoutMode === 'embedded' && items.some(b => b.type === 'checkout')) return false;
            if (t === 'order_summary' && context !== 'thankyou') return false;
            return true;
          }) as type}
            <button type="button" onclick={() => addBlock(type)} class="text-left p-3 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium">
              {BLOCK_LABELS[type]}
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>
