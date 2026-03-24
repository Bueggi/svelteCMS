<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLLabelAttributes } from "svelte/elements";

	interface Props extends HTMLLabelAttributes {}

	let { class: className, children, ...rest }: Props = $props();
</script>

<!-- svelte-ignore a11y_label_has_associated_control -->
<label
	class={cn(
		"text-sm font-medium leading-[1.1] peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
		className
	)}
	{...rest}
>
	{@render children?.()}
</label>
