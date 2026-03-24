<script lang="ts" module>
	import { type VariantProps, cva } from "class-variance-authority";

	export const badgeVariants = cva(
		"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase tracking-widest hover:scale-105 cursor-default",
		{
			variants: {
				variant: {
					default:
						"border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/80 hover:shadow-md",
					luxury:
						"border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10 text-primary hover:bg-primary/20 hover:border-primary/40",
					secondary:
						"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
					destructive:
						"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
					outline: "text-foreground border-border hover:bg-accent hover:text-accent-foreground",
				},
			},
			defaultVariants: {
				variant: "default",
			},
		}
	);

	export type Variant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: Variant;
	}

	let {
		class: className,
		variant = "default",
		children,
		...rest
	}: Props = $props();
</script>

<div class={cn(badgeVariants({ variant }), className)} {...rest}>
	{@render children?.()}
</div>
