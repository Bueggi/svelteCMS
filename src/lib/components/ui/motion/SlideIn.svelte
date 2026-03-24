<script lang="ts">
	import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

	interface Props {
		delay?: number;
		duration?: number;
		direction?: "left" | "right" | "top" | "bottom";
        distance?: number;
		children?: import('svelte').Snippet;
        class?: string;
	}

	let {
		delay = 0,
		duration = 500,
		direction = "left",
        distance = 20,
		children,
        class: className
	}: Props = $props();

    const getFlyParams = () => {
        switch (direction) {
            case "left": return { x: -distance, y: 0 };
            case "right": return { x: distance, y: 0 };
            case "top": return { x: 0, y: -distance };
            case "bottom": return { x: 0, y: distance };
        }
    };
</script>

<div in:fly={{ ...getFlyParams(), duration, delay, easing: cubicOut }} class={className}>
	{@render children?.()}
</div>
