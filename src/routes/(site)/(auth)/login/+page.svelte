<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { Loader2, Eye, EyeOff } from "@lucide/svelte";
    import { goto } from "$app/navigation";
    import { getContext } from "svelte";
    import { getT, type LangKey } from "$lib/i18n";

    let email = $state("");
    let password = $state("");
    let isLoading = $state(false);
    let showPassword = $state(false);
    let error = $state("");

    const langCtx = getContext<{ lang: LangKey } | undefined>('i18n');
    const t = $derived(getT(langCtx?.lang ?? 'de'));

    async function handleLogin() {
        if (!email || !password) { error = t('loginErrRequired'); return; }
        isLoading = true;
        error = "";
        try {
            await authClient.signIn.email({ email, password }, {
                onSuccess: () => goto("/dashboard"),
                onError: (ctx) => { error = ctx.error.message; isLoading = false; }
            });
        } catch {
            error = t('loginErrUnexpected');
            isLoading = false;
        }
    }

</script>

<svelte:head><title>{t('signIn')}</title></svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
    <!-- Background orbs -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
    </div>

    <!-- Form -->
    <div class="relative z-10 w-full max-w-90 space-y-8">

        <div class="space-y-1">
            <h1 class="text-3xl font-serif font-medium tracking-tight">{t('signIn')}</h1>
            <p class="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
        </div>

        <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
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
                />
            </div>

            <div class="field">
                <label for="password">{t('password')}</label>
                <div class="relative">
                    <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        bind:value={password}
                        disabled={isLoading}
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

            <div class="flex justify-end -mt-1">
                <a href="/forgot-password" class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">{t('forgotLink')}</a>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                class="submit-btn"
            >
                {#if isLoading}
                    <Loader2 class="w-4 h-4 animate-spin" />
                {:else}
                    {t('signIn')}
                {/if}
            </button>
        </form>

        <p class="text-center text-sm text-muted-foreground">
            {t('noAccount')}
            <a href="/register" class="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors ml-1">{t('loginCreate')}</a>
        </p>
    </div>
</div>

<style>
    @reference "$src/app.css";

    /* Background orbs */
    .orb {
        position: absolute;
        border-radius: 9999px;
        filter: blur(80px);
        opacity: 0.35;
    }
    .orb-1 {
        width: 45vw; height: 45vw;
        top: -10%; left: -10%;
        background: hsl(var(--primary));
        animation: drift 18s ease-in-out infinite alternate;
    }
    .orb-2 {
        width: 35vw; height: 35vw;
        bottom: -5%; right: -5%;
        background: hsl(var(--accent));
        animation: drift 22s ease-in-out infinite alternate-reverse;
    }
    .orb-3 {
        width: 25vw; height: 25vw;
        top: 55%; left: 55%;
        background: hsl(var(--secondary));
        opacity: 0.2;
        animation: drift 14s ease-in-out infinite alternate;
    }
    @keyframes drift {
        from { transform: translate(0, 0) scale(1); }
        to   { transform: translate(4%, 6%) scale(1.08); }
    }

    /* Field */
    .field {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .field label {
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: hsl(var(--muted-foreground));
    }
    .field input,
    :global(.field input) {
        width: 100%;
        height: 3rem;
        padding: 0 1rem;
        border-radius: 0.875rem;
        border: 1px solid hsl(var(--border));
        background: hsl(var(--muted) / 0.3);
        font-size: 0.875rem;
        color: hsl(var(--foreground));
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .field input:focus {
        border-color: hsl(var(--primary) / 0.6);
        background: hsl(var(--muted) / 0.5);
        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
    }
    .field input::placeholder {
        color: hsl(var(--muted-foreground) / 0.35);
    }
    .field input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Submit */
    .submit-btn {
        margin-top: 0.5rem;
        width: 100%;
        height: 3rem;
        border-radius: 0.875rem;
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 4px 20px hsl(var(--primary) / 0.3);
    }
    .submit-btn:hover:not(:disabled) {
        opacity: 0.92;
        transform: translateY(-1px);
        box-shadow: 0 6px 28px hsl(var(--primary) / 0.4);
    }
    .submit-btn:active:not(:disabled) {
        transform: translateY(0);
    }
    .submit-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
</style>
