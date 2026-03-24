<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	type HeadingLevel = "h1" | "h2" | "h3" | "h4";
	type GradientVariant = "default" | "sunset" | "ocean" | "brand" | "gold" | "feature";

	interface Props extends HTMLAttributes<HTMLHeadingElement> {
		level?: HeadingLevel;
		variant?: GradientVariant;
		size?: "sm" | "md" | "lg" | "xl" | "xxl";
	}

	let {
		class: className,
		level = "h1",
		variant = "default",
		size = "lg",
		children,
		...rest
	}: Props = $props();

	const variants = {
		default: "from-primary to-accent",
		sunset: "from-orange-500 via-pink-500 to-purple-600",
		ocean: "from-blue-400 via-teal-500 to-emerald-400",
		brand: "from-blue-600 via-indigo-500 to-purple-500",
		gold: "from-yellow-400 via-orange-300 to-yellow-600",
		feature: "from-cyan-400 via-blue-500 to-indigo-600"
	};

	const sizes = {
		sm: "text-lg md:text-xl",
		md: "text-xl md:text-2xl",
		lg: "text-3xl md:text-4xl",
		xl: "text-4xl md:text-5xl",
		xxl: "text-5xl md:text-6xl"
	};
</script>

<svelte:element
	this={level}
	class={cn(
		"font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r pb-2",
		variants[variant],
		sizes[size],
		className
	)}
	{...rest}
>
	{@render children?.()}
</svelte:element>
