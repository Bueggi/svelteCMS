<script lang="ts" module>
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	export interface Props extends HTMLAttributes<HTMLDivElement> {}
</script>

<script lang="ts">
	let { class: className, children, ...rest }: Props = $props();
</script>

<div class={cn("flex flex-col space-y-1.5 p-6", className)} {...rest}>
	{@render children?.()}
</div>
