<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, Sparkles, Building2, CreditCard, Mail, ArrowRight, Eye, EyeOff, CheckCircle2, XCircle, Database, KeyRound } from 'lucide-svelte';
	import { getT, langNames, supportedLangs, type LangKey } from '$lib/i18n';

	let { data, form } = $props();
	let step = $derived(data.step);
	let isSubmitting = $state(false);
	let showPassword = $state(false);
	let showStripeSecret = $state(false);
	let showSmtpPass = $state(false);
	let showDbUrl = $state(false);

	// Language for the wizard — reactive, driven by dropdown on step 1.
	// Not yet saved to DB, so we manage it locally.
	let wizardLang = $state<LangKey>(data.defaultLanguage ?? 'de');
	const t = $derived(getT(wizardLang));

	// The database step (0) only exists when DATABASE_URL isn't provided by the environment
	const steps = $derived([
		...(data.showDbStep ? [{ number: 0, label: t('setupStepDb'), icon: Database }] : []),
		{ number: 1, label: t('setupStepApp'),    icon: Building2 },
		{ number: 2, label: t('setupStepAdmin'),  icon: Sparkles },
		{ number: 3, label: t('setupStepStripe'), icon: CreditCard },
		{ number: 4, label: t('setupStepEmail'),  icon: Mail },
	]);
</script>

<svelte:head>
	<title>Setup – {data.appName || t('setupWelcome')}</title>
</svelte:head>

<div class="min-h-screen bg-background flex flex-col items-center justify-center p-4">
	<!-- Decorative background -->
	<div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
		<div class="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
		<div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"></div>
	</div>

	<div class="w-full max-w-lg">
		<!-- Header -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
				<Sparkles class="w-7 h-7 text-primary" />
			</div>
			<h1 class="text-3xl font-serif font-semibold text-foreground">{t('setupWelcome')}</h1>
			<p class="text-muted-foreground mt-1 text-sm">{t('setupSubtitle')}</p>
		</div>

		<!-- Step indicator -->
		{#if !data.locked}
		<div class="flex items-center justify-center gap-0 mb-8">
			{#each steps as s, i}
				<div class="flex items-center">
					<div class="flex flex-col items-center gap-1">
						<div
							class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300
							{s.number < step
								? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
								: s.number === step
									? 'bg-primary/20 text-primary border-2 border-primary'
									: 'bg-muted text-muted-foreground'}"
						>
							{#if s.number < step}
								<Check class="w-4 h-4" />
							{:else}
								{i + 1}
							{/if}
						</div>
						<span class="text-xs {s.number === step ? 'text-primary font-medium' : 'text-muted-foreground'}">
							{s.label}
						</span>
					</div>
					{#if i < steps.length - 1}
						<div
							class="w-12 h-px mt-[-14px] mx-1 transition-colors duration-300
							{s.number < step ? 'bg-primary/50' : 'bg-border'}"
						></div>
					{/if}
				</div>
			{/each}
		</div>

		{/if}

		<!-- Card -->
		<div class="bg-card border border-border/60 rounded-2xl shadow-xl shadow-black/5 overflow-hidden">
			<!-- Error -->
			{#if form?.error}
				<div class="px-8 pt-6">
					<div class="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg px-4 py-3">
						{form.error}
					</div>
				</div>
			{/if}

			<!-- ── Token gate, database (step 0), then step 1: Platform + Language ────────────────────────── -->
			{#if data.locked}
				<form
					method="POST"
					action="?/unlock"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
				>
					<div class="px-8 pt-8 pb-6 space-y-6">
						<div class="flex items-start gap-3">
							<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
								<KeyRound class="w-5 h-5 text-primary" />
							</div>
							<div>
								<h2 class="text-xl font-semibold text-foreground">{t('setupTokenTitle')}</h2>
								<p class="text-sm text-muted-foreground mt-1">{t('setupTokenDesc')}</p>
							</div>
						</div>

						<div class="space-y-2">
							<label for="token" class="text-sm font-medium text-foreground">{t('setupTokenLabel')} *</label>
							<input
								id="token"
								name="token"
								type="password"
								required
								autocomplete="off"
								spellcheck="false"
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
						</div>
					</div>

					<div class="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/20"
						>
							{t('setupTokenSubmit')}
							<ArrowRight class="w-4 h-4" />
						</button>
					</div>
				</form>

			{:else if step === 0}
				<form
					method="POST"
					action="?/stepDb"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
				>
					<div class="px-8 pt-8 pb-6 space-y-6">
						<div>
							<h2 class="text-xl font-semibold text-foreground">{t('setupStepDbTitle')}</h2>
							<p class="text-sm text-muted-foreground mt-1">{t('setupStepDbDesc')}</p>
						</div>

						<div class="space-y-2">
							<label for="databaseUrl" class="text-sm font-medium text-foreground">{t('setupDbUrlLabel')} *</label>
							<div class="relative">
								<input
									id="databaseUrl"
									name="databaseUrl"
									type={showDbUrl ? 'text' : 'password'}
									required
									autocomplete="off"
									spellcheck="false"
									placeholder="postgres://user:password@host:5432/database"
									class="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
								/>
								<button
									type="button"
									onclick={() => (showDbUrl = !showDbUrl)}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								>
									{#if showDbUrl}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
								</button>
							</div>
							<p class="text-xs text-muted-foreground">{t('setupDbUrlHint')}</p>
						</div>
					</div>

					<div class="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/20"
						>
							{isSubmitting ? t('setupDbConnecting') : t('setupDbSubmit')}
							<ArrowRight class="w-4 h-4" />
						</button>
					</div>
				</form>

			{:else if step === 1}
				<form
					method="POST"
					action="?/step1"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
				>
					<div class="px-8 pt-8 pb-6 space-y-6">
						<div>
							<h2 class="text-xl font-semibold text-foreground">{t('setupStep1Title')}</h2>
							<p class="text-sm text-muted-foreground mt-1">{t('setupStep1Desc')}</p>
						</div>

						<!-- Language selection — changes the wizard UI immediately -->
						<div class="space-y-2">
							<label for="defaultLanguage" class="text-sm font-medium text-foreground">{t('setupLangLabel')}</label>
							<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
								{#each supportedLangs as lang}
									<button
										type="button"
										onclick={() => wizardLang = lang}
										class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all
											{wizardLang === lang
												? 'border-primary bg-primary/10 text-primary'
												: 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}"
									>
										{langNames[lang]}
									</button>
								{/each}
							</div>
							<!-- hidden field carries the value into the form -->
							<input type="hidden" name="defaultLanguage" value={wizardLang} />
							<p class="text-xs text-muted-foreground">{t('setupLangDesc')}</p>
						</div>

						<!-- DB Connection Status -->
						<div class="rounded-xl border {data.dbOk ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : 'border-destructive/30 bg-destructive/5'} p-4 space-y-2">
							<div class="flex items-center gap-2">
								{#if data.dbOk}
									<CheckCircle2 class="w-4 h-4 text-green-600 shrink-0" />
									<span class="text-sm font-medium text-green-700 dark:text-green-400">{t('setupDbOk')}</span>
								{:else}
									<XCircle class="w-4 h-4 text-destructive shrink-0" />
									<span class="text-sm font-medium text-destructive">{t('setupDbError')}</span>
								{/if}
							</div>
							<code class="block text-[11px] font-mono text-muted-foreground break-all">{data.dbUrl}</code>
							{#if data.dbError && !data.dbOk}
								<p class="text-xs text-destructive">{data.dbError}</p>
								{#if data.showDbStep}
									<a href="/setup?step=0" class="text-xs text-primary hover:underline">{t('setupDbChange')}</a>
								{:else}
									<p class="text-xs text-muted-foreground">{t('setupDbEnvHint')}</p>
								{/if}
							{/if}
						</div>

						<div class="space-y-2">
							<label for="appName" class="text-sm font-medium text-foreground">{t('setupPlatformName')} *</label>
							<input
								id="appName"
								name="appName"
								type="text"
								required
								placeholder={t('setupPlatformNamePh')}
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
							<p class="text-xs text-muted-foreground">{t('setupPlatformHint')}</p>
						</div>
					</div>

					<div class="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/20"
						>
							{isSubmitting ? t('setupSaving') : t('next')}
							<ArrowRight class="w-4 h-4" />
						</button>
					</div>
				</form>

			<!-- ── Step 2: Admin account ───────────────────────────────── -->
			{:else if step === 2}
				<form
					method="POST"
					action="?/step2"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
				>
					<div class="px-8 pt-8 pb-6 space-y-6">
						<div>
							<h2 class="text-xl font-semibold text-foreground">{t('setupStep2Title')}</h2>
							<p class="text-sm text-muted-foreground mt-1">{t('setupStep2Desc')}</p>
						</div>

						<div class="space-y-2">
							<label for="name" class="text-sm font-medium text-foreground">{t('setupFullName')} *</label>
							<input
								id="name"
								name="name"
								type="text"
								required
								placeholder="Maria Muster"
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
						</div>

						<div class="space-y-2">
							<label for="email" class="text-sm font-medium text-foreground">{t('setupAdminEmail')} *</label>
							<input
								id="email"
								name="email"
								type="email"
								required
								placeholder="admin@deine-domain.de"
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
						</div>

						<div class="space-y-2">
							<label for="password" class="text-sm font-medium text-foreground">{t('setupAdminPassword')} *</label>
							<div class="relative">
								<input
									id="password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									required
									minlength="8"
									placeholder={t('passwordMin')}
									class="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								>
									{#if showPassword}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
								</button>
							</div>
						</div>
					</div>

					<div class="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-between items-center">
						<a href="/setup?step=1" class="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t('back')}</a>
						<button
							type="submit"
							disabled={isSubmitting}
							class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/20"
						>
							{isSubmitting ? t('setupCreating') : t('next')}
							<ArrowRight class="w-4 h-4" />
						</button>
					</div>
				</form>

			<!-- ── Step 3: Stripe ──────────────────────────────────────── -->
			{:else if step === 3}
				<form
					method="POST"
					action="?/step3"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
				>
					<div class="px-8 pt-8 pb-6 space-y-6">
						<div>
							<h2 class="text-xl font-semibold text-foreground">{t('setupStep3Title')}</h2>
							<p class="text-sm text-muted-foreground mt-1">{t('setupStep3Desc')}</p>
						</div>

						<div class="space-y-2">
							<label for="stripeSecretKey" class="text-sm font-medium text-foreground">Secret Key</label>
							<div class="relative">
								<input
									id="stripeSecretKey"
									name="stripeSecretKey"
									type={showStripeSecret ? 'text' : 'password'}
									placeholder="sk_live_..."
									class="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
								/>
								<button
									type="button"
									onclick={() => (showStripeSecret = !showStripeSecret)}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								>
									{#if showStripeSecret}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
								</button>
							</div>
						</div>

						<div class="space-y-2">
							<label for="stripePublishableKey" class="text-sm font-medium text-foreground">Publishable Key</label>
							<input
								id="stripePublishableKey"
								name="stripePublishableKey"
								type="text"
								placeholder="pk_live_..."
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
						</div>

						<div class="space-y-2">
							<label for="stripeWebhookSecret" class="text-sm font-medium text-foreground">
								Webhook Secret <span class="text-muted-foreground font-normal">({t('optional')})</span>
							</label>
							<input
								id="stripeWebhookSecret"
								name="stripeWebhookSecret"
								type="password"
								placeholder="whsec_..."
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
							<p class="text-xs text-muted-foreground">{t('setupStripeWebhookHint')}</p>
						</div>
					</div>

					<div class="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-between items-center">
						<a href="/setup?step=2" class="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t('back')}</a>
						<div class="flex items-center gap-3">
							<button
								type="submit"
								formaction="?/step3"
								disabled={isSubmitting}
								class="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
								onclick={(e) => {
									const form = e.currentTarget.closest('form') as HTMLFormElement;
									form?.querySelectorAll('input').forEach((i: HTMLInputElement) => (i.value = ''));
								}}
							>
								{t('skip')}
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/20"
							>
								{isSubmitting ? t('setupSaving') : t('next')}
								<ArrowRight class="w-4 h-4" />
							</button>
						</div>
					</div>
				</form>

			<!-- ── Step 4: SMTP ────────────────────────────────────────── -->
			{:else if step === 4}
				<form
					method="POST"
					action="?/step4"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
						};
					}}
				>
					<div class="px-8 pt-8 pb-6 space-y-6">
						<div>
							<h2 class="text-xl font-semibold text-foreground">{t('setupStep4Title')}</h2>
							<p class="text-sm text-muted-foreground mt-1">{t('setupStep4Desc')}</p>
						</div>

						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<label for="smtpHost" class="text-sm font-medium text-foreground">{t('setupSmtpHost')}</label>
								<input
									id="smtpHost"
									name="smtpHost"
									type="text"
									placeholder="smtp.brevo.com"
									class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
								/>
							</div>
							<div class="space-y-2">
								<label for="smtpPort" class="text-sm font-medium text-foreground">{t('setupSmtpPort')}</label>
								<input
									id="smtpPort"
									name="smtpPort"
									type="text"
									placeholder="587"
									class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
								/>
							</div>
						</div>

						<div class="space-y-2">
							<label for="smtpUser" class="text-sm font-medium text-foreground">{t('setupSmtpUser')}</label>
							<input
								id="smtpUser"
								name="smtpUser"
								type="text"
								placeholder="deine@email.de"
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
						</div>

						<div class="space-y-2">
							<label for="smtpPass" class="text-sm font-medium text-foreground">{t('setupSmtpPass')}</label>
							<div class="relative">
								<input
									id="smtpPass"
									name="smtpPass"
									type={showSmtpPass ? 'text' : 'password'}
									placeholder="••••••••••••"
									class="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
								/>
								<button
									type="button"
									onclick={() => (showSmtpPass = !showSmtpPass)}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								>
									{#if showSmtpPass}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
								</button>
							</div>
						</div>

						<div class="space-y-2">
							<label for="smtpFrom" class="text-sm font-medium text-foreground">{t('setupSmtpFrom')}</label>
							<input
								id="smtpFrom"
								name="smtpFrom"
								type="text"
								placeholder='"My Academy" <noreply@yourdomain.com>'
								class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
							/>
						</div>

						<label class="flex items-center gap-3 cursor-pointer group">
							<input
								type="checkbox"
								name="smtpSecure"
								class="w-4 h-4 rounded border-input accent-primary cursor-pointer"
							/>
							<span class="text-sm text-foreground group-hover:text-foreground/80">{t('setupSmtpTls')}</span>
						</label>
					</div>

					<div class="px-8 py-4 bg-muted/30 border-t border-border/50 flex justify-between items-center">
						<a href="/setup?step=3" class="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t('back')}</a>
						<div class="flex items-center gap-3">
							<button
								type="submit"
								disabled={isSubmitting}
								class="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
								onclick={(e) => {
									const form = e.currentTarget.closest('form') as HTMLFormElement;
									form?.querySelectorAll('input[type="text"], input[type="password"]').forEach((i: any) => (i.value = ''));
								}}
							>
								{t('skip')}
							</button>
							<button
								type="submit"
								disabled={isSubmitting}
								class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm shadow-primary/20"
							>
								{#if isSubmitting}
									{t('setupFinishing')}
								{:else}
									<Check class="w-4 h-4" />
									{t('setupFinish')}
								{/if}
							</button>
						</div>
					</div>
				</form>
			{/if}
		</div>

		<p class="text-center text-xs text-muted-foreground mt-6">
			{t('setupFootnote')}
		</p>
	</div>
</div>
