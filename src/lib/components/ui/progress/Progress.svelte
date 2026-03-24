<script lang="ts">
	import { cn } from "$lib/utils";

	let { value = 0, max = 100, class: className, ...rest } = $props();
</script>

<div
	class={cn(
		"relative h-2 w-full overflow-hidden rounded-full bg-secondary/20",
		className
	)}
	{...rest}
>
	<div
		class="h-full w-full flex-1 bg-primary transition-all duration-500 ease-in-out"
		style={`transform: translateX(-${100 - (value / max) * 100}%)`}
	></div>
</div>
