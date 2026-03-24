<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: className, children }: Props = $props();
</script>

<div class="overflow-x-auto">
	<table class={cn("w-full text-sm", className)}>
		{@render children()}
	</table>
</div>
