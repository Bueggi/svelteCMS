<script lang="ts">
	import type { Snippet } from "svelte";
	import GlassCard from "$lib/components/ui/glass-card/GlassCard.svelte";

	interface Props {
		title: string;
		description?: string;
		icon?: Snippet;
		children: Snippet;
		footer?: Snippet;
		contentClass?: string;
	}

	let { title, description, icon, children, footer, contentClass = "p-6 space-y-6" }: Props = $props();
</script>

<GlassCard variant="neo" class="p-0 overflow-hidden">
	<div class="p-6 border-b border-white/10 bg-white/5">
		<h3 class="flex items-center gap-2 text-xl font-bold">
			{#if icon}{@render icon()}{/if}
			{title}
		</h3>
		{#if description}
			<p class="text-sm text-muted-foreground mt-1">{description}</p>
		{/if}
	</div>
	<div class={contentClass}>
		{@render children()}
	</div>
	{#if footer}
		<div class="px-6 py-4 bg-muted/30 border-t border-white/10 flex justify-end">
			{@render footer()}
		</div>
	{/if}
</GlassCard>
