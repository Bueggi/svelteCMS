<script lang="ts">
    import { page } from "$app/state";
    import { authClient } from "$lib/auth-client";
    import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from "@lucide/svelte";
    import { getContext } from "svelte";
    import { getT, type LangKey } from "$lib/i18n";
    import AuthShell from "$lib/components/AuthShell.svelte";

    // better-auth sends the user here as /reset-password?token=… (or ?error=INVALID_TOKEN)
    const token = $derived(page.url.searchParams.get("token") ?? "");
    const linkInvalid = $derived(!token || !!page.url.searchParams.get("error"));

    let newPassword = $state("");
    let confirmPassword = $state("");
    let showPassword = $state(false);
    let isLoading = $state(false);
    let done = $state(false);
    let error = $state("");

    const langCtx = getContext<{ lang: LangKey } | undefined>('i18n');
    const t = $derived(getT(langCtx?.lang ?? 'de'));

    async function handleReset() {
        if (newPassword.length < 8) { error = t('resetErrTooShort'); return; }
        if (newPassword !== confirmPassword) { error = t('registerErrPasswordMatch'); return; }
        isLoading = true;
        error = "";
        try {
            const { error: apiError } = await authClient.resetPassword({ newPassword, token });
            if (apiError) error = apiError.message ?? t('loginErrUnexpected');
            else done = true;
        } catch {
            error = t('loginErrUnexpected');
        }
        isLoading = false;
    }
</script>

<svelte:head><title>{t('resetTitle')}</title></svelte:head>

{#if done}
    <AuthShell title={t('resetTitle')}>
        <div class="space-y-4">
            <div class="flex items-start gap-3 text-sm bg-muted/40 border border-border px-4 py-4 rounded-xl">
                <CheckCircle2 class="w-5 h-5 shrink-0 text-primary mt-0.5" />
                <p>{t('resetSuccess')}</p>
            </div>
            <a href="/login" class="submit-btn">{t('signIn')}</a>
        </div>
    </AuthShell>
{:else if linkInvalid}
    <AuthShell title={t('resetInvalidTitle')}>
        <div class="space-y-4">
            <div class="flex items-start gap-3 text-sm bg-destructive/8 border border-destructive/15 text-destructive px-4 py-4 rounded-xl">
                <AlertCircle class="w-5 h-5 shrink-0 mt-0.5" />
                <p>{t('resetInvalidDesc')}</p>
            </div>
            <a href="/forgot-password" class="submit-btn">{t('resetRequestNew')}</a>
        </div>
    </AuthShell>
{:else}
    <AuthShell title={t('resetTitle')} subtitle={t('resetSubtitle')}>
        <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleReset(); }}>
            {#if error}
                <p class="text-sm text-destructive bg-destructive/8 border border-destructive/15 px-4 py-3 rounded-xl">{error}</p>
            {/if}

            <div class="field">
                <label for="newPassword">{t('resetNewPassword')}</label>
                <div class="relative">
                    <input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={t('passwordMin')}
                        bind:value={newPassword}
                        disabled={isLoading}
                        autocomplete="new-password"
                        class="pr-10!"
                    />
                    <button
                        type="button"
                        onclick={() => showPassword = !showPassword}
                        tabindex="-1"
                        class="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                        {#if showPassword}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
                    </button>
                </div>
            </div>

            <div class="field">
                <label for="confirmPassword">{t('registerConfirmPassword')}</label>
                <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    bind:value={confirmPassword}
                    disabled={isLoading}
                    autocomplete="new-password"
                />
            </div>

            <button type="submit" disabled={isLoading} class="submit-btn">
                {#if isLoading}
                    <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                    {t('resetSubmit')}
                {/if}
            </button>
        </form>
    </AuthShell>
{/if}
