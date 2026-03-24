<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: className, children }: Props = $props();
</script>

<tr class={cn("hover:bg-muted/30 transition-colors", className)}>
	{@render children()}
</tr>
