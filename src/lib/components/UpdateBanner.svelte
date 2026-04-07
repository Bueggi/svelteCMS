<script lang="ts">
	import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-svelte';

	let { version, summary }: { version: string; summary: string } = $props();

	let dismissed = $state(false);
	let phase = $state<'idle' | 'starting' | 'running' | 'done' | 'error'>('idle');
	let currentStep = $state(0);
	let errorMessage = $state('');
	let newCommit = $state('');
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
		const lines = text.split('\n');
		// Find highest completed step number
		let step = 0;
		for (const line of lines) {
			const m = line.match(/^\[(\d+)\/6\]/);
			if (m) step = Math.max(step, parseInt(m[1]));
		}
		currentStep = step;

		// Check for new commit
		const commitLine = lines.find(l => l.includes('→'));
		if (commitLine) {
			const m = commitLine.match(/→\s*(\w+)/);
			if (m) newCommit = m[1];
		}

		// Check done
		if (lines.some(l => l.includes('Update abgeschlossen'))) {
			clearInterval(pollInterval);
			phase = 'done';
			setTimeout(() => window.location.reload(), 4000);
			return;
		}

		// Check error
		const errorLine = lines.find(l => /^(error|fatal|FEHLER)/i.test(l.trim()) && !l.includes('2>/dev/null'));
		if (errorLine) {
			clearInterval(pollInterval);
			errorMessage = errorLine.trim();
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
				<div class="mb-8 text-center">
					{#if phase === 'done'}
						<CheckCircle2 class="mx-auto mb-3 h-12 w-12 text-green-400" />
						<h2 class="text-xl font-semibold">Update abgeschlossen!</h2>
						<p class="mt-1 text-sm text-muted-foreground">Seite wird automatisch neu geladen…</p>
					{:else if phase === 'error'}
						<AlertCircle class="mx-auto mb-3 h-12 w-12 text-destructive" />
						<h2 class="text-xl font-semibold">Update fehlgeschlagen</h2>
						<p class="mt-1 text-sm text-muted-foreground">{errorMessage || 'Bitte kontaktiere den Support.'}</p>
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
						{@const active = currentStep === stepNum && phase === 'running'}
						{@const pending = currentStep < stepNum && phase !== 'done'}
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

				{#if phase === 'error'}
					<button
						onclick={() => { phase = 'idle'; }}
						class="mt-6 w-full rounded-md border border-border py-2 text-sm text-muted-foreground transition hover:text-foreground"
					>
						Schließen
					</button>
				{/if}
			</div>
		</div>
	{/if}
{/if}
