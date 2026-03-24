<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		class?: string;
		colspan?: number;
		children?: Snippet;
	}

	let { class: className, colspan, children }: Props = $props();
</script>

<td class={cn("px-6 py-4", className)} {colspan}>
	{@render children?.()}
</td>
