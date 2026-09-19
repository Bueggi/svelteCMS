<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { Loader2, MailCheck } from "@lucide/svelte";
    import { getContext } from "svelte";
    import { getT, type LangKey } from "$lib/i18n";
    import AuthShell from "$lib/components/AuthShell.svelte";

    let email = $state("");
    let isLoading = $state(false);
    let sent = $state(false);
    let error = $state("");

    const langCtx = getContext<{ lang: LangKey } | undefined>('i18n');
    const t = $derived(getT(langCtx?.lang ?? 'de'));

    async function handleSubmit() {
        if (!email) { error = t('loginErrRequired'); return; }
        isLoading = true;
        error = "";
        try {
            const { error: apiError } = await authClient.requestPasswordReset({
                email,
                redirectTo: `${window.location.origin}/reset-password`
            });
            if (apiError) error = apiError.message ?? t('loginErrUnexpected');
            else sent = true;
        } catch {
            error = t('loginErrUnexpected');
        }
        isLoading = false;
    }
</script>

<svelte:head><title>{t('forgotTitle')}</title></svelte:head>

<AuthShell title={t('forgotTitle')} subtitle={sent ? undefined : t('forgotSubtitle')}>
    {#if sent}
        <!-- Same message whether or not the address has an account (no user enumeration) -->
        <div class="flex items-start gap-3 text-sm bg-muted/40 border border-border px-4 py-4 rounded-xl">
            <MailCheck class="w-5 h-5 shrink-0 text-primary mt-0.5" />
            <p>{t('forgotSent')}</p>
        </div>
    {:else}
        <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            {#if error}
                <p class="text-sm text-destructive bg-destructive/8 border border-destructive/15 px-4 py-3 rounded-xl">{error}</p>
            {/if}

            <div class="field">
                <label for="email">{t('emailAddress')}</label>
                <input
                    id="email"
                    type="email"
                    placeholder={t('loginEmailPh')}
                    bind:value={email}
                    disabled={isLoading}
                    autocomplete="email"
                />
            </div>

            <button type="submit" disabled={isLoading} class="submit-btn">
                {#if isLoading}
                    <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                    {t('forgotSend')}
                {/if}
            </button>
        </form>
    {/if}

    <p class="text-center text-sm text-muted-foreground">
        <a href="/login" class="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors">{t('backToLogin')}</a>
    </p>
</AuthShell>
