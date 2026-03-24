<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { RefreshCw, X } from 'lucide-svelte';

	let { version, summary }: { version: string; summary: string } = $props();

	let dismissed = $state(false);
	let isUpdating = $state(false);

	async function applyUpdate() {
		isUpdating = true;
		try {
			const res = await fetch('/api/update', { method: 'POST' });
			const data = await res.json();
			if (data.ok) {
				toast.success(
					'Update gestartet! Die App wird in Kürze neu deployed — bitte kurz warten und dann neu laden.'
				);
			} else {
				toast.error(data.error ?? 'Update konnte nicht gestartet werden.');
				isUpdating = false;
			}
		} catch {
			toast.error('Netzwerkfehler beim Starten des Updates.');
			isUpdating = false;
		}
	}
</script>

{#if !dismissed}
	<div
		class="flex items-center justify-between gap-4 border-b border-gold/30 bg-gold/10 px-6 py-3 text-sm"
	>
		<div class="flex items-center gap-2">
			<RefreshCw class="h-4 w-4 text-gold" />
			<span class="text-foreground">
				<span class="font-semibold text-gold">Version {version}</span> verfügbar —
				{summary}
			</span>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={applyUpdate}
				disabled={isUpdating}
				class="rounded-md bg-gold px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gold/90 disabled:opacity-60"
			>
				{isUpdating ? 'Wird aktualisiert…' : 'Jetzt updaten'}
			</button>
			<button
				onclick={() => (dismissed = true)}
				class="text-muted-foreground hover:text-foreground"
				aria-label="Schließen"
			>
				<X class="h-4 w-4" />
			</button>
		</div>
	</div>
{/if}
