<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		class?: string;
		children?: Snippet;
	}

	let { class: className, children }: Props = $props();
</script>

<th class={cn("px-6 py-3 font-medium uppercase tracking-wider text-xs", className)}>
	{#if children}{@render children()}{/if}
</th>
