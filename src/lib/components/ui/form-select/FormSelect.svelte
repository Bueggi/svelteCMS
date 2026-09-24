<script lang="ts">
	import { cn } from "$lib/utils";
	import type { Snippet } from "svelte";

	interface Props {
		id?: string;
		name?: string;
		value?: string;
		required?: boolean;
		disabled?: boolean;
		class?: string;
		children: Snippet;
		onchange?: (e: Event & { currentTarget: EventTarget & HTMLSelectElement }) => void;
	}

	let { id, name, value = $bindable(), required, disabled, class: className, children, onchange }: Props = $props();
</script>

<select
	{id}
	{name}
	bind:value
	{required}
	{disabled}
	{onchange}
	class={cn(
		"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground",
		"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
		"disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
>
	{@render children()}
</select>
