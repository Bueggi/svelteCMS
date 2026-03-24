<script lang="ts" module>
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	export interface CardProps extends HTMLAttributes<HTMLDivElement> {}
</script>

<script lang="ts">
	let { class: className, children, ...rest }: CardProps = $props();
</script>

<div
	class={cn(
		"rounded-xl border border-border/50 bg-card/50 text-card-foreground shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/20 backdrop-blur-sm",
		className
	)}
	{...rest}
>
	{@render children?.()}
</div>
