<script lang="ts">
	import type { Snippet } from "svelte";
	import { PageTitle } from "$lib/components/ui/page-title";

	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
	}

	let { title, description, actions }: Props = $props();
</script>

<div class="flex items-start justify-between gap-4">
	<div>
		<PageTitle>{title}</PageTitle>
		{#if description}
			<p class="text-muted-foreground mt-1">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex items-center gap-2 shrink-0">
			{@render actions()}
		</div>
	{/if}
</div>
