<script lang="ts">
	import type { Snippet } from "svelte";
	import { cn } from "$lib/utils";
	import GlassCard from "$lib/components/ui/glass-card/GlassCard.svelte";

	interface Props {
		title: string;
		value: string | number;
		description?: string;
		icon?: Snippet;
		class?: string;
	}

	let { title, value, description, icon, class: className }: Props = $props();
</script>

<GlassCard variant="default" class={cn("h-full flex flex-col justify-between group hover:border-primary/30 transition-colors", className)}>
	<div class="flex flex-row items-center justify-between space-y-0 pb-2">
		<h3 class="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{title}</h3>
		{#if icon}
			<div class="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
				{@render icon()}
			</div>
		{/if}
	</div>
	<div>
		<div class="text-3xl font-bold mt-2">{value}</div>
		{#if description}
			<p class="text-xs text-muted-foreground mt-1">{description}</p>
		{/if}
	</div>
</GlassCard>
