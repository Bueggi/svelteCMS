<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: "default" | "neo" | "ghost";
	}

	let {
		class: className,
		variant = "default",
		children,
		...rest
	}: Props = $props();
</script>

<div
	class={cn("theme-card relative overflow-hidden group", className)}
	style="
		background: var(--theme-card-bg);
		border: var(--theme-card-border);
		box-shadow: var(--theme-card-shadow);
		backdrop-filter: blur(var(--theme-card-blur));
		border-radius: var(--theme-card-radius);
		transition: transform var(--theme-transition), box-shadow var(--theme-transition);
	"
	{...rest}
>
	<!-- Shine effect — hidden via --theme-shine-display -->
	<div
		class="theme-shine absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none"
		style="transition: opacity var(--theme-transition); display: var(--theme-shine-display, block);"
	></div>

	<div class="relative z-10">
		{@render children?.()}
	</div>
</div>
