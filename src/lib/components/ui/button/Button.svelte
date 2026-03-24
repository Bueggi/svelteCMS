<script lang="ts" module>
	import { type VariantProps, cva } from "class-variance-authority";

	export const buttonVariants = cva(
		"inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 uppercase tracking-widest active:scale-[0.98]",
		{
			variants: {
				variant: {
					default: "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg hover:-translate-y-0.5",
					luxury: "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-luxury hover:shadow-glow hover:-translate-y-0.5",
					destructive:
						"bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md",
					outline:
						"border border-primary text-primary bg-background hover:bg-primary hover:text-primary-foreground",
					heroOutline: "border border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60 hover:shadow-sm",
					secondary:
						"bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:shadow-md",
					ghost: "hover:bg-accent hover:text-accent-foreground",
					link: "text-primary underline-offset-4 hover:underline",
				},
				size: {
					default: "h-10 px-4 py-2",
					sm: "h-9 rounded-md px-3 text-xs",
					lg: "h-11 rounded-md px-8 text-base",
					xl: "h-14 px-10 text-base font-semibold",
					icon: "h-10 w-10",
				},
			},
			defaultVariants: {
				variant: "default",
				size: "default",
			},
		}
	);

	export type Variant = VariantProps<typeof buttonVariants>["variant"];
	export type Size = VariantProps<typeof buttonVariants>["size"];
</script>

<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	
	type ButtonProps = HTMLButtonAttributes & {
		href?: undefined;
		type?: "button" | "submit" | "reset";
	}

	type AnchorProps = HTMLAnchorAttributes & {
		href: string;
		type?: undefined;
	}

	type Props = (ButtonProps | AnchorProps) & {
		variant?: Variant;
		size?: Size;
	};

	let {
		children,
		class: className,
		variant = "default",
		size = "default",
		href = undefined,
		...rest
	}: Props = $props();
</script>

{#if href}
	<a
		class={cn(buttonVariants({ variant, size, className }))}
		href={href}
		{...rest as any}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		class={cn(buttonVariants({ variant, size, className }))}
		{...rest as any}
	>
		{@render children?.()}
	</button>
{/if}
