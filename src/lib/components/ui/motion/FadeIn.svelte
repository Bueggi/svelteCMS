<script lang="ts">
	import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

	interface Props {
		delay?: number;
		duration?: number;
		y?: number;
        x?: number;
        threshold?: number; /* Threshold for intersection observer if we want scroll reveal, but let's keep it simple for now and just do load reveal */
		children?: import('svelte').Snippet;
        class?: string;
	}

	let {
		delay = 0,
		duration = 400,
		y = 10,
        x = 0,
		children,
        class: className
	}: Props = $props();
</script>

<div in:fly={{ y, x, duration, delay, easing: cubicOut }} class={className}>
	{@render children?.()}
</div>
