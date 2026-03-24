<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		variant?: "admin" | "app";
		class?: string;
		children: Snippet;
	}

	let { variant = "app", class: className, children }: Props = $props();

	const variantClasses = {
		admin: "mx-auto max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500",
		app: "container mx-auto max-w-5xl px-4 py-8 space-y-8 pb-20",
	};
</script>

<div class={cn(variantClasses[variant], className)}>
	{@render children()}
</div>
