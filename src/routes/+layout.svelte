<script lang="ts">
    import "../app.css";
    import { fade, fly } from "svelte/transition";
    import { Shield, User, LogIn, Menu, Globe, Search, ShoppingBag } from "@lucide/svelte";
    import UserMenu from "$lib/components/UserMenu.svelte";
    import { Toaster } from "svelte-sonner";
    import { themes, DEFAULT_THEME } from "$lib/themes";
    import { type LangKey } from "$lib/i18n";
    import { setContext } from "svelte";

    let { children, data } = $props();

    const settings = $derived(data.settings);
    const user = $derived(data.user);

    // ── i18n context ──────────────────────────────────────────────
    // Pass a $state object through context. Child components get it with
    //   const langCtx = getContext<{ lang: LangKey }>('i18n');
    // Reading langCtx.lang in a template creates a reactive dependency,
    // so all consumers re-render when the language changes.
    const langCtx = $state({ lang: (data.settings?.defaultLanguage ?? 'de') as LangKey });
    $effect.pre(() => {
        langCtx.lang = (settings?.defaultLanguage ?? 'de') as LangKey;
    });
    setContext('i18n', langCtx);

    // Resolve the active full theme definition
    const activeTheme = $derived(
        themes.find(t => t.id === (settings?.activeTheme || DEFAULT_THEME.id)) ?? DEFAULT_THEME
    );
    const v = $derived(activeTheme.vars);

    // 5 individually stored custom color overrides (from DB color pickers)
    // Falls back to theme's own values if not set
    const primary    = $derived(settings?.primaryColor    || v.primary);
    const secondary  = $derived(settings?.secondaryColor  || v.secondary);
    const accent     = $derived(settings?.accentColor     || v.accent);
    const background = $derived(settings?.backgroundColor || v.background);
    const foreground = $derived(settings?.foregroundColor || v.foreground);

    function autoFg(hsl: string): string {
        const parts = hsl.trim().split(/[\s,]+/);
        const l = parseFloat(parts[2]);
        return l > 55 ? '30 10% 15%' : '0 0% 100%';
    }

    const primaryFg   = $derived(autoFg(primary));
    const secondaryFg = $derived(autoFg(secondary));
    const accentFg    = $derived(autoFg(accent));

    let isMobileMenuOpen = $state(false);
</script>

<svelte:head>
    <title>{settings?.appName || 'LUMIÈRE'}</title>
    {#if settings?.faviconUrl}
        <link rel="icon" href={settings.faviconUrl} />
    {/if}
    <!-- Inject theme CSS variables into :root so portalled elements (dropdowns, dialogs) also get themed -->
    {@html `<style>:root{
        --radius:${v.radius};
        --background:${background};--foreground:${foreground};
        --card:${v.card};--card-foreground:${v.cardForeground};
        --popover:${v.popover};--popover-foreground:${v.popoverForeground};
        --primary:${primary};--primary-foreground:${primaryFg};
        --secondary:${secondary};--secondary-foreground:${secondaryFg};
        --muted:${v.muted};--muted-foreground:${v.mutedForeground};
        --accent:${accent};--accent-foreground:${accentFg};
        --border:${v.border};--input:${v.input};--ring:${primary};
        --sidebar:${v.sidebar};--sidebar-foreground:${v.sidebarForeground};
        --sidebar-primary:${primary};--sidebar-primary-foreground:${primaryFg};
        --sidebar-accent:${v.sidebarAccent};--sidebar-accent-foreground:${v.sidebarAccentForeground};
        --sidebar-border:${v.sidebarBorder};--sidebar-ring:${primary};
    }</style>`}
</svelte:head>

<div
    class="min-h-screen font-sans"
    data-theme={activeTheme.id}
    style="
        --radius: {v.radius};

        --background: {background};
        --foreground: {foreground};

        --card: {v.card};
        --card-foreground: {v.cardForeground};

        --popover: {v.popover};
        --popover-foreground: {v.popoverForeground};

        --primary: {primary};
        --primary-foreground: {primaryFg};

        --secondary: {secondary};
        --secondary-foreground: {secondaryFg};

        --muted: {v.muted};
        --muted-foreground: {v.mutedForeground};

        --accent: {accent};
        --accent-foreground: {accentFg};

        --border: {v.border};
        --input: {v.input};
        --ring: {primary};

        --sidebar: {v.sidebar};
        --sidebar-foreground: {v.sidebarForeground};
        --sidebar-primary: {primary};
        --sidebar-primary-foreground: {primaryFg};
        --sidebar-accent: {v.sidebarAccent};
        --sidebar-accent-foreground: {v.sidebarAccentForeground};
        --sidebar-border: {v.sidebarBorder};
        --sidebar-ring: {primary};
    "
>
    {@render children()}
    <Toaster position="top-center" richColors />
</div>

<style>
    @reference "$src/app.css";

    :global(.glass-card) {
        backdrop-filter: blur(24px);
        background-color: rgba(255, 255, 255, 0.4);
        box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.05),
                    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
    }

    :global(.shadow-luxury) {
        box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.05);
    }

    :global(.shadow-glow) {
        box-shadow: 0 0 30px -5px var(--color-secondary);
    }
</style>
