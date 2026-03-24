<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: className, children }: Props = $props();
</script>

<h1 class={cn("text-3xl font-serif font-bold tracking-tight", className)}>
	{@render children()}
</h1>
