<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<thead class="bg-muted/50 border-b text-muted-foreground text-left">
	{@render children()}
</thead>
