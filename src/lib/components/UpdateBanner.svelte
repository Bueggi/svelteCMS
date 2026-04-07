<script lang="ts">
	import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-svelte';

	let { version, summary }: { version: string; summary: string } = $props();

	let dismissed = $state(false);
	let phase = $state<'idle' | 'starting' | 'running' | 'done' | 'error'>('idle');
	let currentStep = $state(0);
	let statusLine = $state('');
	let errorLines = $state<string[]>([]);
	let pollInterval: ReturnType<typeof setInterval>;

	const steps = [
		'Aktuelle Version prüfen',
		'Neuesten Code laden',
		'Pakete installieren',
		'App neu bauen',
		'Datenbank aktualisieren',
		'App neu starten',
	];

	function parseLog(text: string) {
		const lines = text.split('\n').filter(Boolean);

		// Find highest step number seen
		let step = 0;
		for (const line of lines) {
			const m = line.match(/^\[(\d+)\/6\]/);
			if (m) step = Math.max(step, parseInt(m[1]));
		}
		currentStep = step;

		// Status line: last non-empty line
		const last = lines[lines.length - 1] ?? '';
		statusLine = last;

		// Done check
		if (lines.some(l => l.includes('Update abgeschlossen'))) {
			clearInterval(pollInterval);
			phase = 'done';
			setTimeout(() => window.location.reload(), 4000);
			return;
		}

		// Error check
		if (lines.some(l => l.startsWith('FEHLER:'))) {
			clearInterval(pollInterval);
			errorLines = lines;
			phase = 'error';
		}
	}

	async function applyUpdate() {
		phase = 'starting';
		currentStep = 0;
		errorMessage = '';

		try {
			const res = await fetch('/api/update', { method: 'POST' });
			const data = await res.json();
			if (!data.ok) {
				errorMessage = data.error ?? 'Unbekannter Fehler';
				phase = 'error';
				return;
			}
		} catch (e: any) {
			errorMessage = e?.message ?? 'Netzwerkfehler';
			phase = 'error';
			return;
		}

		phase = 'running';
		pollInterval = setInterval(async () => {
			try {
				const r = await fetch('/api/update?lines=100');
				const text = await r.text();
				parseLog(text);
			} catch {
				// ignore transient poll errors
			}
		}, 2000);
	}
</script>

{#if !dismissed}
	<!-- Banner strip (always visible) -->
	<div class="border-b border-amber-500/30 bg-amber-500/10">
		<div class="flex items-center justify-between gap-4 px-6 py-3 text-sm">
			<div class="flex items-center gap-2">
				<RefreshCw class="h-4 w-4 text-amber-400" />
				<span class="text-foreground">
					<span class="font-semibold text-amber-400">Version {version}</span> verfügbar —
					{summary}
				</span>
			</div>
			<div class="flex items-center gap-2">
				{#if phase === 'idle'}
					<button
						onclick={applyUpdate}
						class="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-400"
					>
						Jetzt updaten
					</button>
					<button
						onclick={() => { dismissed = true; }}
						class="text-muted-foreground hover:text-foreground transition-colors"
						aria-label="Schließen"
					>
						✕
					</button>
				{:else if phase === 'done'}
					<span class="flex items-center gap-1.5 text-xs font-medium text-green-400">
						<CheckCircle2 class="h-3.5 w-3.5" />
						Fertig — Seite wird neu geladen…
					</span>
				{:else}
					<span class="animate-pulse text-xs text-muted-foreground">Update läuft…</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Fullscreen overlay while running -->
	{#if phase === 'starting' || phase === 'running' || phase === 'done' || phase === 'error'}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
			<div class="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">

				<!-- Header -->
				<div class="mb-6 text-center">
					{#if phase === 'done'}
						<CheckCircle2 class="mx-auto mb-3 h-12 w-12 text-green-400" />
						<h2 class="text-xl font-semibold">Update abgeschlossen!</h2>
						<p class="mt-1 text-sm text-muted-foreground">Seite wird automatisch neu geladen…</p>
					{:else if phase === 'error'}
						<AlertCircle class="mx-auto mb-3 h-12 w-12 text-destructive" />
						<h2 class="text-xl font-semibold">Update fehlgeschlagen</h2>
						<p class="mt-1 text-sm text-muted-foreground">Fehlerdetails unten — bitte an den Support weitergeben.</p>
					{:else}
						<Loader2 class="mx-auto mb-3 h-12 w-12 animate-spin text-amber-400" />
						<h2 class="text-xl font-semibold">Update wird installiert</h2>
						<p class="mt-1 text-sm text-muted-foreground">Bitte nicht schließen oder neu laden.</p>
					{/if}
				</div>

				<!-- Steps -->
				<ol class="space-y-3">
					{#each steps as step, i}
						{@const stepNum = i + 1}
						{@const done = currentStep > stepNum || phase === 'done'}
						{@const active = currentStep === stepNum && (phase === 'running' || phase === 'starting')}
						<li class="flex items-center gap-3">
							<span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold
								{done ? 'bg-green-500/20 text-green-400' : active ? 'bg-amber-500/20 text-amber-400' : 'bg-muted text-muted-foreground'}">
								{#if done}
									✓
								{:else if active}
									<Loader2 class="h-3.5 w-3.5 animate-spin" />
								{:else}
									{stepNum}
								{/if}
							</span>
							<span class="text-sm {done ? 'text-foreground' : active ? 'font-medium text-foreground' : 'text-muted-foreground'}">
								{step}
							</span>
						</li>
					{/each}
				</ol>

				<!-- Status line (current activity) -->
				{#if (phase === 'running' || phase === 'starting') && statusLine}
					<p class="mt-4 truncate text-center font-mono text-[11px] text-muted-foreground">{statusLine}</p>
				{/if}

				<!-- Error log -->
				{#if phase === 'error' && errorLines.length > 0}
					<div class="mt-4 max-h-40 overflow-y-auto rounded-lg bg-[hsl(0_0%_6%)] p-3 font-mono text-[11px] leading-relaxed">
						{#each errorLines as line}
							<div class="{line.startsWith('FEHLER:') || /error/i.test(line) ? 'text-red-400' : line.includes('✓') ? 'text-green-400' : 'text-[hsl(0_0%_70%)]'}">{line}</div>
						{/each}
					</div>
					<button
						onclick={() => { phase = 'idle'; errorLines = []; }}
						class="mt-4 w-full rounded-md border border-border py-2 text-sm text-muted-foreground transition hover:text-foreground"
					>
						Schließen
					</button>
				{/if}
			</div>
		</div>
	{/if}
{/if}
