<script lang="ts">
	import { Badge } from "$lib/components/ui/badge";
	import { cn } from "$lib/utils";

	interface Props {
		status: string;
		label?: string;
		class?: string;
	}

	let { status, label, class: className }: Props = $props();

	const config: Record<string, { class: string; label: string }> = {
		published: { class: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800", label: "Published" },
		draft: { class: "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800", label: "Draft" },
		completed: { class: "bg-green-500/10 text-green-600 border-green-200 dark:bg-green-900/10 dark:border-green-800", label: "Completed" },
		refunded: { class: "bg-red-500/10 text-red-500 border-red-200", label: "Refunded" },
		disputed: { class: "bg-orange-500/10 text-orange-600 border-orange-200", label: "Disputed" },
		active: { class: "bg-green-500/10 text-green-600 border-green-200 dark:bg-green-900/10 dark:border-green-800", label: "Active" },
		inactive: { class: "bg-red-500/10 text-red-500 border-red-200", label: "Inactive" },
		cancelled: { class: "bg-red-500/10 text-red-500 border-red-200", label: "Cancelled" },
		expired: { class: "text-muted-foreground border-muted-foreground/30", label: "Expired" },
		lifetime: { class: "bg-indigo-500/10 text-indigo-600 border-indigo-200", label: "Lifetime" },
		subscription: { class: "bg-purple-500/10 text-purple-600 border-purple-200", label: "Subscription" },
		duration: { class: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Fixed Duration" },
		fixed: { class: "bg-blue-500/10 text-blue-600 border-blue-200", label: "Fixed" },
		global: { class: "text-muted-foreground border-border", label: "Global" },
	};

	const cfg = config[status] ?? { class: "text-muted-foreground", label: status };
</script>

<Badge variant="outline" class={cn(cfg.class, className)}>
	{label ?? cfg.label}
</Badge>
