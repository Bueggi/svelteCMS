<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLButtonAttributes } from "svelte/elements";

	interface Props extends HTMLButtonAttributes {
		variant?: "default" | "outline" | "ghost";
	}

	let {
		class: className,
		variant = "default",
		children,
		...rest
	}: Props = $props();

    // Shine animation is handled via utility class or inline style if complex, 
    // but here we use a pseudo-element logic via Tailwind's group and overflow.
    // Actually, a moving gradient background is easier.
</script>

<button
	class={cn(
		"group relative inline-flex h-11 items-center justify-center overflow-hidden rounded-md bg-primary px-8 font-medium text-primary-foreground transition-all duration-300 hover:bg-primary/90 hover:ring-2 hover:ring-primary hover:ring-offset-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        variant === "outline" && "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        variant === "ghost" && "hover:bg-accent hover:text-accent-foreground bg-transparent",
		className
	)}
	{...rest}
>
    <!-- Shimmer effect -->
	<div class="absolute inset-0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent z-10 skew-x-12"></div>
	
	<span class="relative z-20 flex items-center gap-2">
		{@render children?.()}
	</span>
</button>
