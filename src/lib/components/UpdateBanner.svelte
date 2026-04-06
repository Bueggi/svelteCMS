<script lang="ts">
	import { RefreshCw, X, Terminal, CheckCircle2 } from 'lucide-svelte';

	let { version, summary }: { version: string; summary: string } = $props();

	let dismissed = $state(false);
	let phase = $state<'idle' | 'starting' | 'running' | 'done' | 'error'>('idle');
	let logLines = $state<string[]>([]);
	let showLog = $state(false);
	let pollInterval: ReturnType<typeof setInterval>;

	async function applyUpdate() {
		phase = 'starting';
		showLog = true;
		logLines = ['Update wird gestartet…'];

		try {
			const res = await fetch('/api/update', { method: 'POST' });
			const data = await res.json();
			if (!data.ok) {
				logLines = [`Fehler: ${data.error ?? 'Unbekannt'}`];
				phase = 'error';
				return;
			}
		} catch (e: any) {
			logLines = [`Netzwerkfehler: ${e?.message ?? 'Unbekannt'}`];
			phase = 'error';
			return;
		}

		// Poll the log every 2 seconds
		phase = 'running';
		pollInterval = setInterval(async () => {
			try {
				const r = await fetch('/api/update?lines=100');
				const text = await r.text();
				logLines = text.split('\n').filter(Boolean);

				const last = logLines[logLines.length - 1] ?? '';
				if (last.includes('Update abgeschlossen')) {
					clearInterval(pollInterval);
					phase = 'done';
					// Auto-reload after 4 seconds
					setTimeout(() => window.location.reload(), 4000);
				}
			} catch {
				// ignore poll errors
			}
		}, 2000);
	}

	function stopPolling() {
		clearInterval(pollInterval);
	}
</script>

{#if !dismissed}
	<div class="border-b border-amber-500/30 bg-amber-500/10">
		<!-- Banner row -->
		<div class="flex items-center justify-between gap-4 px-6 py-3 text-sm">
			<div class="flex items-center gap-2">
				<RefreshCw class="h-4 w-4 text-amber-400 {phase === 'running' ? 'animate-spin' : ''}" />
				<span class="text-foreground">
					<span class="font-semibold text-amber-400">Version {version}</span> verfügbar —
					{summary}
				</span>
			</div>
			<div class="flex items-center gap-2">
				{#if phase === 'done'}
					<span class="flex items-center gap-1.5 text-xs font-medium text-green-400">
						<CheckCircle2 class="h-3.5 w-3.5" />
						Fertig — Seite wird neu geladen…
					</span>
				{:else if phase === 'idle'}
					<button
						onclick={applyUpdate}
						class="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-400"
					>
						Jetzt updaten
					</button>
				{:else if phase === 'running' || phase === 'starting'}
					<span class="text-xs text-muted-foreground animate-pulse">Läuft…</span>
					<button
						onclick={() => { showLog = !showLog; }}
						class="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						<Terminal class="h-3 w-3" />
						Log
					</button>
				{:else if phase === 'error'}
					<span class="text-xs text-destructive font-medium">Fehler — siehe Log</span>
				{/if}

				{#if phase !== 'running' && phase !== 'starting'}
					<button
						onclick={() => { dismissed = true; stopPolling(); }}
						class="text-muted-foreground hover:text-foreground"
						aria-label="Schließen"
					>
						<X class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>

		<!-- Log output (collapsible) -->
		{#if showLog && logLines.length > 0}
			<div class="border-t border-amber-500/20 px-6 py-3">
				<div class="relative max-h-56 overflow-y-auto rounded-lg bg-[hsl(0_0%_6%)] p-4 font-mono text-[11px] leading-relaxed text-[hsl(0_0%_80%)]">
					{#each logLines as line}
						<div
							class="{line.includes('✓') ? 'text-green-400' : line.includes('Fehler') || line.includes('error') ? 'text-red-400' : line.startsWith('[') ? 'text-amber-300' : line.startsWith('===') ? 'text-amber-400 font-semibold' : ''}"
						>{line}</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
