<script lang="ts">
  import {
    Settings, BookOpen, MessageSquare, ShoppingBag,
    ChevronLeft, ExternalLink
  } from 'lucide-svelte';
  import { cn } from '$lib/utils';

  let {
    courseId,
    courseSlug,
    courseTitle,
    isPublished,
    activeTab,
    onTabChange,
  }: {
    courseId: string;
    courseSlug: string;
    courseTitle: string;
    isPublished: boolean;
    activeTab: string;
    onTabChange: (tab: string) => void;
  } = $props();

  const tabItems = [
    {
      section: 'Kurs',
      items: [
        { id: 'settings', label: 'Einstellungen', icon: Settings },
        { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
      ],
    },
    {
      section: 'Community',
      items: [
        { id: 'community', label: 'Channels', icon: MessageSquare },
      ],
    },
    {
      section: 'Monetarisierung',
      items: [
        { id: 'sell', label: 'Verkauf & Links', icon: ShoppingBag },
      ],
    },
  ];
</script>

<aside class="w-56 shrink-0 self-start sticky top-24 space-y-1">
  <!-- Back + course title -->
  <div class="mb-5">
    <a href="/admin/courses" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3">
      <ChevronLeft class="w-3.5 h-3.5" /> Alle Kurse
    </a>
    <p class="font-serif font-semibold text-foreground leading-snug line-clamp-2 text-sm">{courseTitle}</p>
    <span class="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider {isPublished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}">
      {isPublished ? 'Veröffentlicht' : 'Entwurf'}
    </span>
  </div>

  <!-- Tab sections -->
  {#each tabItems as section}
    <div class="pb-3">
      <p class="px-3 mb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-bold">{section.section}</p>
      {#each section.items as item}
        <button
          onclick={() => onTabChange(item.id)}
          class={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left',
            activeTab === item.id
              ? 'bg-primary/10 text-primary font-medium shadow-sm'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
          )}
        >
          <item.icon class="w-4 h-4 shrink-0" />
          {item.label}
        </button>
      {/each}
    </div>
  {/each}

  <!-- Preview link -->
  <div class="border-t border-border/40 pt-3">
    <a
      href="/admin/preview/courses/{courseSlug}/learn"
      target="_blank"
      class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    >
      <ExternalLink class="w-4 h-4 shrink-0" />
      Kurs-Vorschau
    </a>
  </div>
</aside>
