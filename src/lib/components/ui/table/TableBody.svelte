<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<tbody class="divide-y divide-border/50">
	{@render children()}
</tbody>
