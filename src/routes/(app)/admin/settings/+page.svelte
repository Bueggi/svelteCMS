<script lang="ts">
    import { enhance } from '$app/forms';
    import { toast } from 'svelte-sonner';
    import { invalidateAll } from '$app/navigation';
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import GlassCard from "$lib/components/ui/glass-card/GlassCard.svelte";
    import { Settings, Palette, Globe, Plug, Receipt, Server, CheckCircle2, XCircle, RefreshCw, Database, FileText } from "lucide-svelte";
    import { Eye, EyeOff } from "lucide-svelte";
    import { fade } from 'svelte/transition';
    import { themes, DEFAULT_THEME } from "$lib/themes";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { PageHeader } from "$lib/components/ui/page-header";
    import { FormSelect } from "$lib/components/ui/form-select";
    import { getContext } from "svelte";
    import { getT as getTranslator, langNames, supportedLangs, type LangKey } from "$lib/i18n";
    import MediaPicker from "$lib/components/MediaPicker.svelte";

    const langCtx = getContext<{ lang: LangKey }>('i18n');
    const t = $derived(getTranslator(langCtx.lang));
    const getT = (k: Parameters<ReturnType<typeof getTranslator>>[0]) => t(k);

    let { data, form } = $props();
    let settings = $derived(data.settings);
    let envVars = $derived(data.envVars);
    let dbUrl = $derived(data.dbUrl);
    let dbOk = $derived(form?.pingOk !== undefined ? form.pingOk : data.dbOk);
    let dbError = $derived(form?.pingError ?? data.dbError);
    let activeTab = $state(
        typeof window !== 'undefined'
            ? (new URL(window.location.href).searchParams.get('tab') ?? 'general')
            : 'general'
    );
    let isSaving = $state(false);

    // ── Invoice template state ────────────────────────────────────────────────
    let invoiceTemplate = $state(settings?.invoiceTemplate ?? '');
    let invoiceFooter = $state(settings?.invoiceFooter ?? '');
    let invoicePrefix = $state(settings?.invoicePrefix ?? 'INV');
    let showTemplateVars = $state(false);

    // Sync from server whenever data refreshes (e.g. after save)
    $effect(() => {
        invoiceTemplate = settings?.invoiceTemplate ?? '';
        invoiceFooter   = settings?.invoiceFooter   ?? '';
        invoicePrefix   = settings?.invoicePrefix   ?? 'INV';
    });

    // ── Checkout customization state ─────────────────────────────────────────
    type LegalItem = { text: string; required: boolean };
    let checkoutButtonColorHex = $state(settings?.checkoutButtonColor ?? '');
    let legalItems = $state<LegalItem[]>([]);

    $effect(() => {
        checkoutButtonColorHex = settings?.checkoutButtonColor ?? '';
        try {
            const raw = JSON.parse(settings?.checkoutLegalTexts || '[]');
            legalItems = (raw as any[]).map(item =>
                typeof item === 'string' ? { text: item, required: true } : { text: item.text ?? '', required: item.required !== false }
            );
        } catch { legalItems = []; }
    });

    function addLegalItem() {
        legalItems = [...legalItems, { text: '', required: true }];
    }

    function removeLegalItem(i: number) {
        legalItems = legalItems.filter((_, idx) => idx !== i);
    }

    const TEMPLATE_VARS = [
        { name: '{{invoice_number}}',     desc: 'Rechnungsnummer, z.B. INV-2026-0001' },
        { name: '{{invoice_date}}',       desc: 'Rechnungsdatum' },
        { name: '{{company_name}}',       desc: 'Firmenname (aus Einstellungen)' },
        { name: '{{company_address}}',    desc: 'Firmenadresse (HTML, mehrzeilig)' },
        { name: '{{company_vat_id}}',     desc: 'USt-IdNr. der Firma' },
        { name: '{{company_email}}',      desc: 'E-Mail der Firma' },
        { name: '{{customer_name}}',      desc: 'Name des Kunden' },
        { name: '{{customer_email}}',     desc: 'E-Mail des Kunden' },
        { name: '{{customer_address}}',   desc: 'Adresse des Kunden (HTML, mehrzeilig)' },
        { name: '{{customer_vat_id_row}}',desc: 'USt-IdNr. Zeile (leer wenn nicht gesetzt)' },
        { name: '{{items_rows}}',         desc: 'HTML-Tabellenzeilen der Positionen' },
        { name: '{{subtotal}}',           desc: 'Nettobetrag' },
        { name: '{{vat_rate}}',           desc: 'MwSt-Prozentsatz, z.B. 19' },
        { name: '{{vat_row}}',            desc: 'MwSt-Zeile (leer bei Reverse Charge)' },
        { name: '{{total}}',              desc: 'Gesamtbetrag (brutto)' },
        { name: '{{currency_symbol}}',    desc: 'Währungssymbol, z.B. €' },
        { name: '{{reverse_charge_row}}', desc: 'Hinweis-Zeile wenn Reverse Charge gilt' },
        { name: '{{notes}}',              desc: 'Fußtext / Rechtliche Hinweise' },
    ];
    // ── Per-theme custom CSS ──────────────────────────────────────────────────
    let themeCustomCssMap = $state<Record<string, string>>({});
    let currentThemeCss = $state('');

    $effect(() => {
        try { themeCustomCssMap = JSON.parse((settings as any)?.themeCustomCss || '{}'); } catch { themeCustomCssMap = {}; }
    });

    // When selectedThemeId changes, load that theme's CSS into the editor
    $effect(() => {
        currentThemeCss = themeCustomCssMap[selectedThemeId] ?? '';
    });

    // Live-inject custom CSS while editing (before save)
    $effect(() => {
        let el = document.getElementById('theme-custom-css-preview') as HTMLStyleElement | null;
        if (!el) {
            el = document.createElement('style');
            el.id = 'theme-custom-css-preview';
            document.head.appendChild(el);
        }
        el.textContent = currentThemeCss;
    });

    let showStripeSecret = $state(false);

    // Logo & Favicon upload state
    let logoUrl = $state(settings?.logoUrl || '');
    let faviconUrl = $state(settings?.faviconUrl || '');
    let logoUploading = $state(false);
    let faviconUploading = $state(false);

    $effect.pre(() => {
        logoUrl = settings?.logoUrl || '';
        faviconUrl = settings?.faviconUrl || '';
    });

    let showWebhookSecret = $state(false);
    let showSmtpPass = $state(false);
    let showPaypalSecret = $state(false);
    let enabledMethods = $state<string[]>(['card']);

    $effect.pre(() => {
        try { enabledMethods = JSON.parse(settings?.enabledPaymentMethods || '["card"]'); } catch { enabledMethods = ['card']; }
    });

    // ── Theme picker state ───────────────────────────────────────
    // Helper: get theme color with DB override as fallback
    function themeColor(dbVal: string | null | undefined, key: keyof typeof DEFAULT_THEME.colors): string {
        if (dbVal) return dbVal;
        const t = themes.find(th => th.id === (settings?.activeTheme || DEFAULT_THEME.id)) ?? DEFAULT_THEME;
        return t.colors[key];
    }

    let selectedThemeId = $state(settings?.activeTheme || DEFAULT_THEME.id);
    let pickerPrimary   = $state(themeColor(settings?.primaryColor,   'primary'));
    let pickerSecondary = $state(themeColor(settings?.secondaryColor, 'secondary'));
    let pickerAccent    = $state(themeColor(settings?.accentColor,    'accent'));
    let pickerBg        = $state(themeColor(settings?.backgroundColor,'background'));
    let pickerFg        = $state(themeColor(settings?.foregroundColor,'foreground'));

    // Hex counterparts — bound directly to <input type="color">.
    // Kept separate so that user interaction with the color wheel never
    // changes pickerPrimary mid-drag (which would remount the input and close the picker).
    let hexPrimary   = $state(hslToHex(pickerPrimary));
    let hexSecondary = $state(hslToHex(pickerSecondary));
    let hexAccent    = $state(hslToHex(pickerAccent));
    let hexBg        = $state(hslToHex(pickerBg));
    let hexFg        = $state(hslToHex(pickerFg));

    $effect.pre(() => {
        // Re-sync from server data whenever settings load/reload.
        // IMPORTANT: compute savedThemeId first, then write to selectedThemeId.
        // If we wrote selectedThemeId first and then read it, Svelte would treat
        // selectedThemeId as a dependency and re-run this effect every time the
        // user clicks a theme card — instantly resetting the selection.
        // Compute everything from settings into local consts first.
        // Assigning to $state writes; reading $state creates a dependency.
        // If we read pickerPrimary here (e.g. hslToHex(pickerPrimary)) Svelte
        // would re-run this effect whenever selectTheme() changes pickerPrimary.
        const savedThemeId = settings?.activeTheme || DEFAULT_THEME.id;
        const t  = themes.find(th => th.id === savedThemeId) ?? DEFAULT_THEME;
        const p  = settings?.primaryColor    || t.colors.primary;
        const s  = settings?.secondaryColor  || t.colors.secondary;
        const a  = settings?.accentColor     || t.colors.accent;
        const bg = settings?.backgroundColor || t.colors.background;
        const fg = settings?.foregroundColor || t.colors.foreground;
        // Write — no dependency created on the targets
        selectedThemeId = savedThemeId;
        pickerPrimary   = p;   hexPrimary   = hslToHex(p);
        pickerSecondary = s;   hexSecondary = hslToHex(s);
        pickerAccent    = a;   hexAccent    = hslToHex(a);
        pickerBg        = bg;  hexBg        = hslToHex(bg);
        pickerFg        = fg;  hexFg        = hslToHex(fg);
    });

    function selectTheme(id: string) {
        selectedThemeId = id;
        const t = themes.find(th => th.id === id) ?? DEFAULT_THEME;
        pickerPrimary   = t.colors.primary;   hexPrimary   = hslToHex(t.colors.primary);
        pickerSecondary = t.colors.secondary; hexSecondary = hslToHex(t.colors.secondary);
        pickerAccent    = t.colors.accent;    hexAccent    = hslToHex(t.colors.accent);
        pickerBg        = t.colors.background; hexBg       = hslToHex(t.colors.background);
        pickerFg        = t.colors.foreground; hexFg       = hslToHex(t.colors.foreground);
    }

    // ── Live preview: apply theme + colors to page immediately ───
    $effect(() => {
        const root = document.querySelector('[data-theme]') as HTMLElement | null;
        if (!root) return;
        // Switch theme style immediately
        root.setAttribute('data-theme', selectedThemeId);
        // Apply color overrides immediately (no save needed to see the result)
        root.style.setProperty('--primary',    pickerPrimary);
        root.style.setProperty('--secondary',  pickerSecondary);
        root.style.setProperty('--accent',     pickerAccent);
        root.style.setProperty('--background', pickerBg);
        root.style.setProperty('--foreground', pickerFg);
        // Also update :root for portalled elements
        document.documentElement.style.setProperty('--primary',    pickerPrimary);
        document.documentElement.style.setProperty('--secondary',  pickerSecondary);
        document.documentElement.style.setProperty('--accent',     pickerAccent);
        document.documentElement.style.setProperty('--background', pickerBg);
        document.documentElement.style.setProperty('--foreground', pickerFg);
    });

    const PAYMENT_METHODS = [
        { id: 'card', label: 'Kreditkarte', description: 'Visa, Mastercard, Amex. Inkl. Apple Pay & Google Pay automatisch.', badge: 'Empfohlen' },
        { id: 'sepa_debit', label: 'SEPA-Lastschrift', description: 'Bankeinzug für DE/AT/CH Kunden. Ideal für höhere Beträge.' },
        { id: 'klarna', label: 'Klarna', description: 'Ratenkauf & Kauf auf Rechnung. Muss im Stripe-Dashboard aktiviert sein.' },
        { id: 'link', label: '1-Click Checkout (Link)', description: 'Stripe Link: gespeicherte Karten für schnellen Checkout.' },
        { id: 'sofort', label: 'SOFORT', description: 'Sofort-Überweisung. Hinweis: Wird von Stripe schrittweise eingestellt.', badge: 'Veraltet' },
        { id: 'paypal', label: 'PayPal', description: 'Erfordert PayPal Client ID & Secret (oben konfigurieren).' },
    ];

    const tabs = $derived([
        { id: 'general',      label: getT('settingsTabGeneral'),      icon: Settings },
        { id: 'branding',     label: getT('settingsTabBranding'),     icon: Globe },
        { id: 'theme',        label: getT('settingsTabTheme'),        icon: Palette },
        { id: 'integrations', label: getT('settingsTabIntegrations'), icon: Plug },
        { id: 'invoicing',    label: getT('settingsTabInvoicing'),    icon: Receipt },
        { id: 'system',       label: getT('settingsTabSystem'),       icon: Server },
        { id: 'database',     label: getT('settingsTabDatabase'),     icon: Database },
        { id: 'invoices',     label: 'Rechnungsvorlage',              icon: FileText },
    ]);

    // ── DB migration state ────────────────────────────────────────────
    let newDbUrl = $state('');
    let showNewDbUrl = $state(false);
    let testStatus = $state<'idle' | 'testing' | 'ok' | 'error'>('idle');
    let testError = $state('');
    let migrating = $state(false);
    let migrationLog = $state<{ step: string; message: string; ok?: boolean }[]>([]);

    async function testNewConnection() {
        testStatus = 'testing';
        testError = '';
        try {
            const res = await fetch('/api/admin/db-migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test', targetUrl: newDbUrl }),
            });
            const data = await res.json();
            if (data.ok) {
                testStatus = 'ok';
            } else {
                testStatus = 'error';
                testError = data.error ?? 'Verbindungsfehler';
            }
        } catch (e: any) {
            testStatus = 'error';
            testError = e?.message ?? 'Netzwerkfehler';
        }
    }

    async function startMigration() {
        migrating = true;
        migrationLog = [];
        try {
            const res = await fetch('/api/admin/db-migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'migrate', targetUrl: newDbUrl }),
            });
            const reader = res.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6));
                            migrationLog = [...migrationLog, event];
                        } catch {}
                    }
                }
            }
        } catch (e: any) {
            migrationLog = [...migrationLog, { step: 'error', message: e?.message ?? 'Netzwerkfehler' }];
        } finally {
            migrating = false;
        }
    }

    // Helper functions for Color Conversion
    function hslToHex(hslStr: string) {
        if (!hslStr) return '#000000';
        const [h, s, l] = hslStr.split(' ').map(v => parseFloat(v));
        
        const lVal = l / 100;
        const a = s * Math.min(lVal, 1 - lVal) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = lVal - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }

    function hexToHsl(hex: string) {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt('0x' + hex[1] + hex[1]);
            g = parseInt('0x' + hex[2] + hex[2]);
            b = parseInt('0x' + hex[3] + hex[3]);
        } else if (hex.length === 7) {
            r = parseInt('0x' + hex[1] + hex[2]);
            g = parseInt('0x' + hex[3] + hex[4]);
            b = parseInt('0x' + hex[5] + hex[6]);
        }
        
        r /= 255;
        g /= 255;
        b /= 255;
        
        const cmin = Math.min(r,g,b),
            cmax = Math.max(r,g,b),
            delta = cmax - cmin;
        let h = 0, s = 0, l = 0;
        
        if (delta === 0) h = 0;
        else if (cmax === r) h = ((g - b) / delta) % 6;
        else if (cmax === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        
        l = (cmax + cmin) / 2;
        s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        
        s = +(s * 100).toFixed(1);
        l = +(l * 100).toFixed(1);
        
        return `${h} ${s}% ${l}%`;
    }
</script>

<PageContainer variant="admin">
    <PageHeader title={getT('settingsTitle')} description={getT('settingsDesc')} />

    <div class="flex flex-col md:flex-row gap-8">
        <!-- Sidebar Tabs -->
        <aside class="w-full md:w-64 space-y-2">
            {#each tabs as tab}
                <button 
                    class="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 {activeTab === tab.id ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'}"
                    onclick={() => activeTab = tab.id}
                >
                    <tab.icon class="w-4 h-4" />
                    {tab.label}
                </button>
            {/each}
        </aside>

        <!-- Content Area -->
        <main class="flex-1 min-h-[400px]">
            {#if activeTab === 'integrations'}
            <GlassCard variant="neo" class="p-0 overflow-hidden">
                <form method="POST" action="?/updateIntegrations" use:enhance={() => {
                    isSaving = true;
                    return async ({ update, result }) => {
                        await update();
                        isSaving = false;
                        if (result.type === 'success') toast.success('Integrationen gespeichert');
                        else toast.error('Fehler beim Speichern');
                    };
                }}>
                    <div class="p-8 space-y-8">
                        <!-- Stripe Section -->
                        <div class="space-y-6">
                            <div class="border-b border-white/10 pb-4">
                                <h2 class="text-xl font-bold">Stripe</h2>
                                <p class="text-sm text-muted-foreground">
                                    Zahlungsabwicklung. Keys findest du im Stripe Dashboard → Developers → API keys.
                                    Werte hier haben <strong>Vorrang</strong> vor Umgebungsvariablen.
                                </p>
                            </div>

                            <div class="grid gap-2">
                                <div class="flex items-center gap-2">
                                    <Label for="stripeSecretKey">Secret Key</Label>
                                    {#if envVars?.stripeSecretKey}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Via Umgebungsvariable aktiv</span>
                                    {:else if settings?.stripeSecretKey}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Gespeichert</span>
                                    {/if}
                                </div>
                                <div class="relative">
                                    <Input id="stripeSecretKey" name="stripeSecretKey"
                                        type={showStripeSecret ? 'text' : 'password'}
                                        value={settings?.stripeSecretKey || ''}
                                        placeholder={envVars?.stripeSecretKey ? '(Umgebungsvariable aktiv — hier überschreiben)' : 'sk_live_...'}
                                        class="bg-background/50 font-mono pr-10" />
                                    <button type="button" onclick={() => showStripeSecret = !showStripeSecret}
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {#if showStripeSecret}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
                                    </button>
                                </div>
                            </div>

                            <div class="grid gap-2">
                                <div class="flex items-center gap-2">
                                    <Label for="stripePublishableKey">Publishable Key</Label>
                                    {#if settings?.stripePublishableKey}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Gespeichert</span>
                                    {/if}
                                </div>
                                <Input id="stripePublishableKey" name="stripePublishableKey"
                                    value={settings?.stripePublishableKey || ''}
                                    placeholder="pk_live_..." class="bg-background/50 font-mono" />
                            </div>

                            <!-- Stripe Test Keys -->
                            <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-4">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Test Keys (Sandbox)</span>
                                    <span class="text-xs text-muted-foreground">Werden für Funnel-Sandbox-Modus verwendet</span>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="stripeTestSecretKey">Test Secret Key</Label>
                                    {#if settings?.stripeTestSecretKey}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Gespeichert</span>
                                    {/if}
                                    <Input id="stripeTestSecretKey" name="stripeTestSecretKey"
                                        type="password"
                                        value={settings?.stripeTestSecretKey || ''}
                                        placeholder="sk_test_..."
                                        class="bg-background/50 font-mono" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="stripeTestPublishableKey">Test Publishable Key</Label>
                                    {#if settings?.stripeTestPublishableKey}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Gespeichert</span>
                                    {/if}
                                    <Input id="stripeTestPublishableKey" name="stripeTestPublishableKey"
                                        value={settings?.stripeTestPublishableKey || ''}
                                        placeholder="pk_test_..."
                                        class="bg-background/50 font-mono" />
                                </div>
                            </div>

                            <div class="grid gap-2">
                                <div class="flex items-center gap-2">
                                    <Label for="stripeWebhookSecret">Webhook Secret</Label>
                                    {#if envVars?.stripeWebhookSecret}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Via Umgebungsvariable aktiv</span>
                                    {:else if settings?.stripeWebhookSecret}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Gespeichert</span>
                                    {/if}
                                </div>
                                <div class="relative">
                                    <Input id="stripeWebhookSecret" name="stripeWebhookSecret"
                                        type={showWebhookSecret ? 'text' : 'password'}
                                        value={settings?.stripeWebhookSecret || ''}
                                        placeholder={envVars?.stripeWebhookSecret ? '(Umgebungsvariable aktiv — hier überschreiben)' : 'whsec_...'}
                                        class="bg-background/50 font-mono pr-10" />
                                    <button type="button" onclick={() => showWebhookSecret = !showWebhookSecret}
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {#if showWebhookSecret}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- PayPal Section -->
                        <div class="space-y-6">
                            <div class="border-b border-white/10 pb-4">
                                <h2 class="text-xl font-bold">PayPal</h2>
                                <p class="text-sm text-muted-foreground">Für PayPal-Zahlungen. Keys im PayPal Developer Dashboard → My Apps.</p>
                            </div>

                            <div class="flex items-center gap-3">
                                <input type="checkbox" id="paypalSandbox" name="paypalSandbox" class="w-4 h-4" checked={settings?.paypalSandbox ?? true} />
                                <Label for="paypalSandbox">Sandbox-Modus (Testmodus)</Label>
                            </div>

                            <div class="grid gap-2">
                                <div class="flex items-center gap-2">
                                    <Label for="paypalClientId">Client ID</Label>
                                    {#if envVars?.paypalClientId}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Via Umgebungsvariable aktiv</span>
                                    {:else if settings?.paypalClientId}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Gespeichert</span>
                                    {/if}
                                </div>
                                <Input id="paypalClientId" name="paypalClientId" value={settings?.paypalClientId || ''}
                                    placeholder={envVars?.paypalClientId ? '(Umgebungsvariable aktiv — hier überschreiben)' : 'AXxxx...'}
                                    class="bg-background/50 font-mono" />
                            </div>

                            <div class="grid gap-2">
                                <div class="flex items-center gap-2">
                                    <Label for="paypalClientSecret">Client Secret</Label>
                                    {#if envVars?.paypalClientSecret}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">Via Umgebungsvariable aktiv</span>
                                    {:else if settings?.paypalClientSecret}
                                        <span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">✓ Gespeichert</span>
                                    {/if}
                                </div>
                                <div class="relative">
                                    <Input id="paypalClientSecret" name="paypalClientSecret" type={showPaypalSecret ? 'text' : 'password'} value={settings?.paypalClientSecret || ''}
                                        placeholder={envVars?.paypalClientSecret ? '(Umgebungsvariable aktiv — hier überschreiben)' : 'EXxxx...'}
                                        class="bg-background/50 font-mono pr-10" />
                                    <button type="button" onclick={() => showPaypalSecret = !showPaypalSecret} class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {#if showPaypalSecret}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Payment Methods Section -->
                        <div class="space-y-6">
                            <div class="border-b border-white/10 pb-4">
                                <h2 class="text-xl font-bold">Zahlungsmethoden</h2>
                                <p class="text-sm text-muted-foreground">Aktive Zahlungsmethoden im Checkout. Stripe-Methoden müssen auch in deinem Stripe-Dashboard aktiviert sein.</p>
                            </div>

                            <!-- Hidden input to store the JSON -->
                            <input type="hidden" name="enabledPaymentMethods" value={JSON.stringify(enabledMethods)} />

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {#each PAYMENT_METHODS as method}
                                    <label class="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors {enabledMethods.includes(method.id) ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-card/40 hover:border-border'}">
                                        <input type="checkbox" class="mt-0.5 w-4 h-4 accent-primary" checked={enabledMethods.includes(method.id)} onchange={(e) => {
                                            if (e.currentTarget.checked) { enabledMethods = [...enabledMethods, method.id]; }
                                            else { enabledMethods = enabledMethods.filter(m => m !== method.id); }
                                        }} />
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="font-medium text-sm">{method.label}</span>
                                                {#if method.badge}<span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{method.badge}</span>{/if}
                                            </div>
                                            <p class="text-xs text-muted-foreground mt-0.5">{method.description}</p>
                                        </div>
                                    </label>
                                {/each}
                            </div>
                        </div>

                        <!-- SMTP Section -->
                        <div class="space-y-6">
                            <div class="border-b border-white/10 pb-4">
                                <h2 class="text-xl font-bold">E-Mail (SMTP)</h2>
                                <p class="text-sm text-muted-foreground">Für Willkommens-E-Mails, Passwort-Reset und Kauf-Bestätigungen.</p>
                            </div>

                            <div class="grid sm:grid-cols-2 gap-4">
                                <div class="grid gap-2">
                                    <Label for="smtpHost">SMTP-Host</Label>
                                    <Input id="smtpHost" name="smtpHost"
                                        value={settings?.smtpHost || ''}
                                        placeholder="smtp.brevo.com" class="bg-background/50" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="smtpPort">Port</Label>
                                    <Input id="smtpPort" name="smtpPort"
                                        value={settings?.smtpPort || ''}
                                        placeholder="587" class="bg-background/50" />
                                </div>
                            </div>

                            <div class="grid gap-2">
                                <Label for="smtpUser">Benutzername</Label>
                                <Input id="smtpUser" name="smtpUser"
                                    value={settings?.smtpUser || ''}
                                    placeholder="deine@email.de" class="bg-background/50" />
                            </div>

                            <div class="grid gap-2">
                                <Label for="smtpPass">Passwort / API-Key</Label>
                                <div class="relative">
                                    <Input id="smtpPass" name="smtpPass"
                                        type={showSmtpPass ? 'text' : 'password'}
                                        value={settings?.smtpPass || ''}
                                        placeholder="••••••••" class="bg-background/50 pr-10" />
                                    <button type="button" onclick={() => showSmtpPass = !showSmtpPass}
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {#if showSmtpPass}<EyeOff class="w-4 h-4" />{:else}<Eye class="w-4 h-4" />{/if}
                                    </button>
                                </div>
                            </div>

                            <div class="grid gap-2">
                                <Label for="smtpFrom">Absender-Adresse</Label>
                                <Input id="smtpFrom" name="smtpFrom"
                                    value={settings?.smtpFrom || ''}
                                    placeholder='"Meine Academy" <noreply@deine-domain.de>' class="bg-background/50" />
                            </div>

                            <label class="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" name="smtpSecure"
                                    checked={settings?.smtpSecure ?? false}
                                    class="w-4 h-4 rounded border-input accent-primary" />
                                <span class="text-sm text-foreground">TLS/SSL verwenden (Port 465)</span>
                            </label>
                        </div>
                    </div>

                    <div class="px-8 py-4 bg-muted/30 border-t border-white/10 flex justify-end">
                        <Button type="submit" disabled={isSaving} class="shadow-lg shadow-primary/20">
                            {isSaving ? 'Saving...' : 'Save Integrations'}
                        </Button>
                    </div>
                </form>
            </GlassCard>
            {:else if activeTab === 'invoicing'}
            <GlassCard variant="neo" class="p-0 overflow-hidden">
                <form method="POST" action="?/updateInvoicing" use:enhance={() => {
                    isSaving = true;
                    return async ({ update, result }) => {
                        await update();
                        isSaving = false;
                        if (result.type === 'success') toast.success('Steuer- & Rechnungseinstellungen gespeichert');
                        else toast.error('Fehler beim Speichern — bitte Konsole prüfen');
                    };
                }}>
                    <div class="p-8 space-y-8">

                        <!-- Unternehmensdaten -->
                        <div class="space-y-6">
                            <div class="border-b border-white/10 pb-4">
                                <h2 class="text-xl font-bold">Unternehmensdaten</h2>
                                <p class="text-sm text-muted-foreground">Pflichtangaben für rechtskonforme Rechnungen (Impressum, Rechnung, E-Mail-Footer).</p>
                            </div>

                            <div class="grid gap-2">
                                <Label for="companyName">Firmenname / Inhabername</Label>
                                <Input id="companyName" name="companyName" value={settings?.companyName || ''} placeholder="Lumière Academy GmbH" class="bg-background/50" />
                            </div>

                            <div class="grid sm:grid-cols-3 gap-4">
                                <div class="sm:col-span-2 grid gap-2">
                                    <Label for="companyStreet">Straße & Hausnummer</Label>
                                    <Input id="companyStreet" name="companyStreet" value={settings?.companyStreet || ''} placeholder="Musterstraße 1" class="bg-background/50" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="companyZip">PLZ</Label>
                                    <Input id="companyZip" name="companyZip" value={settings?.companyZip || ''} placeholder="10115" class="bg-background/50" />
                                </div>
                            </div>

                            <div class="grid sm:grid-cols-2 gap-4">
                                <div class="grid gap-2">
                                    <Label for="companyCity">Ort</Label>
                                    <Input id="companyCity" name="companyCity" value={settings?.companyCity || ''} placeholder="Berlin" class="bg-background/50" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="companyCountry">Land (ISO-Code)</Label>
                                    <Input id="companyCountry" name="companyCountry" value={settings?.companyCountry || 'DE'} placeholder="DE" class="bg-background/50" maxlength={2} />
                                    <p class="text-xs text-muted-foreground">2-stellig: DE, AT, CH, …</p>
                                </div>
                            </div>

                            <div class="grid sm:grid-cols-2 gap-4">
                                <div class="grid gap-2">
                                    <Label for="companyVatId">Umsatzsteuer-ID</Label>
                                    <Input id="companyVatId" name="companyVatId" value={settings?.companyVatId || ''} placeholder="DE123456789" class="bg-background/50 font-mono" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="companyEmail">Rechnungs-E-Mail</Label>
                                    <Input id="companyEmail" name="companyEmail" type="email" value={settings?.companyEmail || ''} placeholder="rechnungen@example.de" class="bg-background/50" />
                                </div>
                            </div>

                            <div class="grid gap-2">
                                <Label for="companyPhone">Telefon (optional)</Label>
                                <Input id="companyPhone" name="companyPhone" value={settings?.companyPhone || ''} placeholder="+49 30 12345678" class="bg-background/50" />
                            </div>
                        </div>

                        <!-- Steuer -->
                        <div class="space-y-6">
                            <div class="border-b border-white/10 pb-4">
                                <h2 class="text-xl font-bold">Steuereinstellungen</h2>
                                <p class="text-sm text-muted-foreground">Preise im System gelten als Bruttopreise (inkl. MwSt.). Der Steuerbetrag wird im Checkout informativ ausgewiesen.</p>
                            </div>

                            <div class="grid gap-2">
                                <Label for="vatRate">Mehrwertsteuersatz (%)</Label>
                                <div class="flex items-center gap-3 max-w-xs">
                                    <Input id="vatRate" name="vatRate" type="number" min="0" max="100" value={settings?.vatRate ?? 0} class="bg-background/50 font-mono" />
                                    <span class="text-muted-foreground text-sm shrink-0">%</span>
                                </div>
                                <p class="text-xs text-muted-foreground">z. B. 19 für Deutschland, 20 für Österreich, 0 für steuerfreie Leistungen.</p>
                            </div>

                            <div class="rounded-xl border border-border/60 p-5 space-y-4 bg-card/40">
                                <label class="flex items-start gap-3 cursor-pointer">
                                    <input type="checkbox" id="reverseChargeEnabled" name="reverseChargeEnabled"
                                        class="w-4 h-4 mt-0.5 accent-primary"
                                        checked={settings?.reverseChargeEnabled ?? false} />
                                    <div>
                                        <p class="font-medium text-sm">Reverse Charge aktivieren</p>
                                        <p class="text-xs text-muted-foreground mt-0.5">Wenn aktiviert, können B2B-Kunden eine USt-IdNr. angeben. Bei gültiger EU-USt-IdNr. aus einem anderen EU-Land wird 0 % MwSt. berechnet und der Netto-Preis in Rechnung gestellt (§ 13b UStG).</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Checkout-Anpassungen -->
                        <div class="space-y-6">
                            <div class="border-b border-white/10 pb-4">
                                <h2 class="text-xl font-bold">Checkout-Anpassungen</h2>
                                <p class="text-sm text-muted-foreground">Button-Farbe und rechtliche Pflicht-/Opt-in-Checkboxen im Bestellprozess.</p>
                            </div>

                            <!-- Button Color -->
                            <div class="grid gap-2">
                                <Label for="checkoutButtonColor">Bezahlen-Button Farbe</Label>
                                <div class="flex items-center gap-3">
                                    <input
                                        type="color"
                                        id="checkoutButtonColorPicker"
                                        value={checkoutButtonColorHex || '#000000'}
                                        oninput={(e) => checkoutButtonColorHex = e.currentTarget.value}
                                        class="w-10 h-10 rounded cursor-pointer border border-border bg-transparent p-0.5 shrink-0"
                                    />
                                    <input
                                        type="text"
                                        id="checkoutButtonColor"
                                        name="checkoutButtonColor"
                                        bind:value={checkoutButtonColorHex}
                                        placeholder="#e86a3a (leer = Primärfarbe)"
                                        class="flex-1 rounded-md border border-input bg-background/50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                    {#if checkoutButtonColorHex}
                                        <button type="button" onclick={() => checkoutButtonColorHex = ''} class="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded border border-border">Zurücksetzen</button>
                                    {/if}
                                </div>
                                <p class="text-xs text-muted-foreground">Leer lassen = Standard-Primärfarbe des aktiven Themes.</p>
                            </div>

                            <!-- Legal Checkboxen Array -->
                            <div class="grid gap-3">
                                <div class="flex items-center justify-between">
                                    <Label>Checkboxen im Checkout</Label>
                                    <button
                                        type="button"
                                        onclick={addLegalItem}
                                        class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                                        Checkbox hinzufügen
                                    </button>
                                </div>

                                {#if legalItems.length === 0}
                                    <div class="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                                        Noch keine Checkboxen. Klicke „Checkbox hinzufügen".
                                    </div>
                                {:else}
                                    <div class="space-y-2">
                                        {#each legalItems as item, i}
                                            <div class="flex gap-2 items-start rounded-lg border border-border/60 bg-card/40 p-3">
                                                <div class="flex-1 space-y-2">
                                                    <textarea
                                                        rows={2}
                                                        bind:value={item.text}
                                                        placeholder="Ich bestätige, dass die digitale Leistung sofort erbracht wird…"
                                                        class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                                    ></textarea>
                                                    <div class="flex items-center gap-4">
                                                        <label class="flex items-center gap-2 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                bind:checked={item.required}
                                                                class="w-4 h-4 accent-primary"
                                                            />
                                                            <span class="text-xs font-medium">
                                                                {#if item.required}
                                                                    <span class="text-destructive">Pflichtfeld</span> — Kauf ohne Haken nicht möglich
                                                                {:else}
                                                                    <span class="text-muted-foreground">Optional</span> — Kauf auch ohne Haken möglich
                                                                {/if}
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onclick={() => removeLegalItem(i)}
                                                    class="mt-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                                    aria-label="Entfernen"
                                                >
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                                </button>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                                <!-- Hidden field carries the JSON to the server -->
                                <input type="hidden" name="checkoutLegalTexts" value={JSON.stringify(legalItems)} />
                                <p class="text-xs text-muted-foreground">Pflichtfelder müssen angehakt sein bevor der Kauf abgeschlossen werden kann. Optionale Felder sind vorausgefüllt oder können ignoriert werden.</p>
                            </div>
                        </div>

                    </div>
                    <div class="px-8 py-4 bg-muted/30 border-t border-white/10 flex justify-end">
                        <Button type="submit" disabled={isSaving} class="shadow-lg shadow-primary/20">
                            {isSaving ? 'Saving...' : 'Einstellungen speichern'}
                        </Button>
                    </div>
                </form>
            </GlassCard>

            {:else if activeTab === 'invoices'}
            <GlassCard variant="neo" class="p-0 overflow-hidden">
                <form method="POST" action="?/updateInvoiceTemplate" use:enhance={() => {
                    isSaving = true;
                    return async ({ update }) => { await update({ reset: false }); isSaving = false; };
                }}>
                    <div class="p-8 space-y-8">
                        <div class="border-b border-white/10 pb-4">
                            <h2 class="text-xl font-bold">Rechnungsvorlage</h2>
                            <p class="text-sm text-muted-foreground mt-1">
                                Passe das HTML deiner Rechnungen komplett an. Verwende die Platzhalter unten für dynamische Inhalte.
                                <a href="/admin/invoices" class="text-primary underline ml-1">→ Alle Rechnungen ansehen</a>
                            </p>
                        </div>

                        <!-- Invoice number prefix -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div class="grid gap-2">
                                <Label for="invoicePrefix">Rechnungsnummer-Präfix</Label>
                                <Input id="invoicePrefix" name="invoicePrefix" bind:value={invoicePrefix} placeholder="INV" class="bg-background/50 font-mono" />
                                <p class="text-xs text-muted-foreground">Ergibt z.B. <span class="font-mono">{invoicePrefix || 'INV'}-2026-0001</span></p>
                            </div>
                        </div>

                        <!-- Footer / legal notes -->
                        <div class="grid gap-2">
                            <Label for="invoiceFooter">Fußtext / Rechtliche Hinweise</Label>
                            <textarea
                                id="invoiceFooter"
                                name="invoiceFooter"
                                bind:value={invoiceFooter}
                                rows="4"
                                placeholder="Zahlbar sofort nach Rechnungserhalt. Bei Fragen wende dich an support@example.com ..."
                                class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                            ></textarea>
                            <p class="text-xs text-muted-foreground">Erscheint als {'{{notes}}'} im Template ganz unten auf der Rechnung.</p>
                        </div>

                        <!-- Template variables reference -->
                        <div>
                            <button
                                type="button"
                                onclick={() => showTemplateVars = !showTemplateVars}
                                class="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                            >
                                <FileText class="w-4 h-4" />
                                {showTemplateVars ? 'Platzhalter ausblenden' : 'Verfügbare Platzhalter anzeigen'}
                            </button>
                            {#if showTemplateVars}
                                <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/30 p-4">
                                    {#each TEMPLATE_VARS as v}
                                        <div class="flex items-start gap-2 text-xs">
                                            <code class="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-primary">{v.name}</code>
                                            <span class="text-muted-foreground">{v.desc}</span>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>

                        <!-- HTML Editor + live preview -->
                        <div class="grid gap-2">
                            <div class="flex items-center justify-between">
                                <Label for="invoiceTemplate">HTML-Vorlage</Label>
                                <span class="text-xs text-muted-foreground">Leer lassen = Standard-Template wird verwendet</span>
                            </div>
                            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <!-- Editor -->
                                <div class="flex flex-col gap-2">
                                    <textarea
                                        id="invoiceTemplate"
                                        name="invoiceTemplate"
                                        bind:value={invoiceTemplate}
                                        rows="30"
                                        placeholder="<!DOCTYPE html>&#10;<html>&#10;  <!-- Deine individuelle Rechnungsvorlage -->&#10;</html>"
                                        spellcheck="false"
                                        class="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring leading-relaxed"
                                        style="tab-size: 2;"
                                    ></textarea>
                                    <p class="text-xs text-muted-foreground">
                                        Vollständiges HTML inkl. &lt;style&gt;-Block. Platzhalter wie {'{{invoice_number}}'} werden beim Erstellen ersetzt.
                                    </p>
                                </div>
                                <!-- Preview -->
                                <div class="flex flex-col gap-2">
                                    <div class="flex items-center justify-between">
                                        <span class="text-sm font-medium">Vorschau</span>
                                        <a
                                            href="/admin/invoices"
                                            target="_blank"
                                            class="text-xs text-primary hover:underline"
                                        >Echte Rechnung öffnen →</a>
                                    </div>
                                    <div class="rounded-md border border-border overflow-hidden bg-white" style="height: 600px;">
                                        <iframe
                                            srcdoc={invoiceTemplate || '<p style="font-family:sans-serif;padding:24px;color:#888">Vorlage eingeben, um Vorschau zu sehen...</p>'}
                                            title="Rechnungsvorschau"
                                            class="w-full h-full"
                                            sandbox="allow-same-origin"
                                        ></iframe>
                                    </div>
                                    <p class="text-xs text-muted-foreground">Die Vorschau zeigt das rohe Template ohne ersetzter Platzhalter.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end gap-3 px-8 py-5 border-t border-white/10 bg-muted/10">
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Speichern...' : 'Vorlage speichern'}
                        </Button>
                    </div>
                </form>
            </GlassCard>

            {:else if activeTab === 'system'}
            <GlassCard variant="neo" class="p-0 overflow-hidden">
                <div class="p-8 space-y-8">
                    <div class="border-b border-white/10 pb-4">
                        <h2 class="text-xl font-bold">System & Datenbank</h2>
                        <p class="text-sm text-muted-foreground">Schreibgeschützte Systeminfos. Die Datenbankverbindung kann nur über die Umgebungsvariable <code class="font-mono text-xs bg-muted px-1 py-0.5 rounded">DATABASE_URL</code> geändert werden — ein Neustart der App ist danach erforderlich.</p>
                    </div>

                    <!-- DB Connection -->
                    <div class="space-y-4">
                        <h3 class="font-semibold text-sm">Datenbankverbindung</h3>

                        <div class="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
                            <!-- Status row -->
                            <div class="flex items-center justify-between gap-4">
                                <div class="flex items-center gap-2">
                                    {#if dbOk}
                                        <CheckCircle2 class="w-5 h-5 text-green-500 shrink-0" />
                                        <span class="text-sm font-medium text-green-600 dark:text-green-400">Verbunden</span>
                                    {:else}
                                        <XCircle class="w-5 h-5 text-destructive shrink-0" />
                                        <span class="text-sm font-medium text-destructive">Verbindungsfehler</span>
                                    {/if}
                                </div>
                                <form method="POST" action="?/pingDb" use:enhance={() => {
                                    return async ({ update }) => { await update({ reset: false }); };
                                }}>
                                    <Button type="submit" variant="outline" size="sm" class="gap-1.5">
                                        <RefreshCw class="w-3.5 h-3.5" /> Testen
                                    </Button>
                                </form>
                            </div>

                            {#if dbError && !dbOk}
                                <p class="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 font-mono">{dbError}</p>
                            {/if}

                            <!-- URL (masked, read-only) -->
                            <div class="space-y-1.5">
                                <p class="text-xs font-medium text-muted-foreground">DATABASE_URL</p>
                                <div class="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5 border border-border/40">
                                    <code class="text-xs font-mono flex-1 text-foreground/80 break-all">{dbUrl}</code>
                                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium shrink-0">ENV</span>
                                </div>
                                <p class="text-xs text-muted-foreground">Passwort ist maskiert.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Environment Info -->
                    <div class="space-y-4">
                        <h3 class="font-semibold text-sm">Umgebung</h3>
                        <div class="rounded-xl border border-border/60 bg-card/40 p-5 space-y-3 text-sm">
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">Laufzeitumgebung</span>
                                <code class="font-mono text-xs bg-muted px-2 py-0.5 rounded">{data.nodeEnv ?? 'production'}</code>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-muted-foreground">Setup abgeschlossen</span>
                                <span class={settings?.setupCompleted ? 'text-green-600' : 'text-amber-500'}>
                                    {settings?.setupCompleted ? '✓ Ja' : '✗ Nein'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>

            {:else}
             <GlassCard variant="neo" class="p-0 overflow-hidden">
                <form method="POST" action="?/updateSettings" use:enhance={() => {
                    isSaving = true;
                    return async ({ update, result }) => {
                        await update();
                        await invalidateAll();
                        isSaving = false;
                        if (result.type === 'success') toast.success('Einstellungen gespeichert');
                        else toast.error('Fehler beim Speichern');
                    };
                }}>
                    <div class="p-8 space-y-8">
                        <div class={activeTab === 'general' ? 'block' : 'hidden'}>
                            <div class="space-y-6" in:fade>
                                <div class="border-b border-white/10 pb-4 mb-6">
                                    <h2 class="text-xl font-bold">{getT('settingsGeneralTitle')}</h2>
                                    <p class="text-sm text-muted-foreground">{getT('settingsGeneralDesc')}</p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="appName">{getT('settingsAppName')}</Label>
                                    <Input id="appName" name="appName" value={settings?.appName || ''} placeholder="My Online Course" class="bg-background/50" />
                                    <p class="text-xs text-muted-foreground">{getT('settingsAppNameDesc')}</p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="adminName">{getT('settingsAdminName')}</Label>
                                    <Input id="adminName" name="adminName" value={settings?.adminName || ''} placeholder="Maria Muster" class="bg-background/50" />
                                </div>

                                <div class="grid gap-2">
                                    <Label for="adminEmail">{getT('settingsAdminEmail')}</Label>
                                    <Input id="adminEmail" name="adminEmail" type="email" value={settings?.adminEmail || ''} placeholder="admin@example.com" class="bg-background/50" />
                                    <p class="text-xs text-muted-foreground">{getT('settingsAdminEmailDesc')}</p>
                                </div>

                                <div class="grid gap-2">
                                    <Label for="defaultLanguage">{getT('settingsLanguage')}</Label>
                                    <FormSelect id="defaultLanguage" name="defaultLanguage" class="bg-background/50" value={settings?.defaultLanguage || 'de'}>
                                        {#each supportedLangs as lang}
                                            <option value={lang}>{langNames[lang]}</option>
                                        {/each}
                                    </FormSelect>
                                    <p class="text-xs text-muted-foreground">{getT('settingsLanguageDesc')}</p>
                                </div>

                                <div class="flex items-center justify-between rounded-lg border border-white/10 p-4">
                                    <div>
                                        <p class="font-medium text-sm">Registrierung erlauben</p>
                                        <p class="text-xs text-muted-foreground">Wenn deaktiviert, können sich neue User nicht selbst registrieren. Accounts werden nur über Käufe erstellt.</p>
                                    </div>
                                    <label class="relative inline-flex items-center cursor-pointer ml-4">
                                        <input
                                            type="checkbox"
                                            name="registrationEnabled"
                                            value="true"
                                            checked={settings?.registrationEnabled !== false}
                                            class="sr-only peer"
                                        />
                                        <div class="w-11 h-6 bg-muted peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                <!-- Site URL -->
                                <div class="border-t border-white/10 pt-6 space-y-4">
                                    <div>
                                        <h3 class="text-base font-semibold">Checkout</h3>
                                        <p class="text-sm text-muted-foreground">Basis-URL der Website für Stripe-Weiterleitungen.</p>
                                    </div>

                                    <div class="grid gap-2">
                                        <Label for="siteUrl">Website-URL</Label>
                                        <Input id="siteUrl" name="siteUrl" value={settings?.siteUrl || ''} placeholder="https://deineshop.de" class="bg-background/50" />
                                        <p class="text-xs text-muted-foreground">Wird für Stripe Erfolgs-/Abbruch-URLs verwendet. Muss ohne abschließenden Schrägstrich angegeben werden.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class={activeTab === 'branding' ? 'block' : 'hidden'}>
                            <div class="space-y-8" in:fade>
                                <div class="border-b border-white/10 pb-4">
                                    <h2 class="text-xl font-bold">Branding</h2>
                                    <p class="text-sm text-muted-foreground">Logo, Favicon und App-Name.</p>
                                </div>

                                <!-- Hidden inputs carry the URLs into the form -->
                                <input type="hidden" name="logoUrl" value={logoUrl} />
                                <input type="hidden" name="faviconUrl" value={faviconUrl} />

                                <!-- Logo -->
                                <div class="space-y-2">
                                    <Label>Logo</Label>
                                    <p class="text-xs text-muted-foreground">Wird in der Sidebar angezeigt. Empfohlene Höhe: 40 px. PNG, SVG oder WebP.</p>
                                    <MediaPicker bind:value={logoUrl} bind:uploading={logoUploading} label="Logo hochladen" />
                                </div>

                                <!-- Logo Text -->
                                <div class="grid gap-2">
                                    <Label for="logoText">Text neben dem Logo</Label>
                                    <Input id="logoText" name="logoText" value={settings?.logoText || ''} placeholder={settings?.appName || 'LUMIÈRE'} class="bg-background/50" />
                                    <p class="text-xs text-muted-foreground">Wird neben dem Logo in der Sidebar angezeigt. Leer lassen = App-Name wird verwendet.</p>
                                </div>

                                <!-- Favicon -->
                                <div class="space-y-2">
                                    <Label>Favicon</Label>
                                    <p class="text-xs text-muted-foreground">Wird im Browser-Tab angezeigt. ICO, PNG oder SVG. Empfohlen: 32×32 px oder 64×64 px.</p>
                                    <MediaPicker bind:value={faviconUrl} bind:uploading={faviconUploading} accept="image/*,.ico" label="Favicon hochladen" />
                                </div>
                            </div>
                        </div>

                        <div class={activeTab === 'theme' ? 'block' : 'hidden'}>
                            <div class="space-y-8" in:fade>
                                <div class="border-b border-white/10 pb-4">
                                    <h2 class="text-xl font-bold">Theme Appearance</h2>
                                    <p class="text-sm text-muted-foreground">Wähle ein Theme — alle Farben, Abstände und Radien werden automatisch angepasst.</p>
                                </div>

                                <!-- Hidden activeTheme field, updated when a card is clicked -->
                                <input type="hidden" name="activeTheme" id="activeThemeInput" value={selectedThemeId} />
                                <!-- Keep custom color fields present but clear them when theme is picked -->
                                <input type="hidden" name="primaryColor" id="pickerPrimary" value={pickerPrimary} />
                                <input type="hidden" name="secondaryColor" id="pickerSecondary" value={pickerSecondary} />
                                <input type="hidden" name="accentColor" id="pickerAccent" value={pickerAccent} />
                                <input type="hidden" name="backgroundColor" id="pickerBg" value={pickerBg} />
                                <input type="hidden" name="foregroundColor" id="pickerFg" value={pickerFg} />
                                <!-- CSS for the active theme -->
                                <input type="hidden" name="themeCustomCssForActive" value={currentThemeCss} />

                                <!-- Theme Cards -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {#each themes as theme}
                                        {@const isActive = selectedThemeId === theme.id}
                                        {@const r = theme.vars.radius}
                                        <button
                                            type="button"
                                            onclick={() => selectTheme(theme.id)}
                                            class="group text-left rounded-xl border-2 transition-all duration-200 overflow-hidden {isActive ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-primary/50'}"
                                        >
                                            <!-- Mini UI preview -->
                                            <div class="h-28 w-full flex overflow-hidden" style="background-color: hsl({theme.preview.bg})">
                                                <!-- Sidebar strip -->
                                                <div class="w-16 h-full flex flex-col py-2 px-1.5 gap-1.5 shrink-0 border-r" style="background-color: hsl({theme.vars.sidebar}); border-color: hsl({theme.vars.border})">
                                                    <div class="h-1.5 w-9 opacity-50" style="background-color: hsl({theme.preview.primary}); border-radius: {r}"></div>
                                                    <div class="h-5 w-full flex items-center gap-1 px-1 opacity-90" style="background-color: hsl({theme.preview.primary} / 0.15); border-radius: {r}">
                                                        <div class="w-2 h-2 rounded-sm opacity-70" style="background-color: hsl({theme.preview.primary})"></div>
                                                        <div class="h-1 w-5 opacity-60" style="background-color: hsl({theme.preview.primary}); border-radius: {r}"></div>
                                                    </div>
                                                    <div class="h-4 w-full flex items-center gap-1 px-1 opacity-40" style="border-radius: {r}">
                                                        <div class="w-2 h-2 opacity-40" style="background-color: hsl({theme.vars.mutedForeground}); border-radius: {r}"></div>
                                                        <div class="h-1 w-4 opacity-40" style="background-color: hsl({theme.vars.mutedForeground}); border-radius: {r}"></div>
                                                    </div>
                                                    <div class="h-4 w-full flex items-center gap-1 px-1 opacity-40">
                                                        <div class="w-2 h-2 opacity-40" style="background-color: hsl({theme.vars.mutedForeground}); border-radius: {r}"></div>
                                                        <div class="h-1 w-6 opacity-40" style="background-color: hsl({theme.vars.mutedForeground}); border-radius: {r}"></div>
                                                    </div>
                                                </div>
                                                <!-- Content area -->
                                                <div class="flex-1 p-2.5 flex flex-col gap-2">
                                                    <!-- Card -->
                                                    <div class="flex-1 border p-2 flex flex-col gap-1.5" style="background-color: hsl({theme.vars.card}); border-color: hsl({theme.vars.border}); border-radius: {r}">
                                                        <div class="h-1.5 w-16" style="background-color: hsl({theme.vars.foreground}); border-radius: {r}; opacity: 0.8"></div>
                                                        <div class="h-1 w-full opacity-25" style="background-color: hsl({theme.vars.mutedForeground}); border-radius: {r}"></div>
                                                        <div class="h-1 w-2/3 opacity-20" style="background-color: hsl({theme.vars.mutedForeground}); border-radius: {r}"></div>
                                                        <div class="mt-auto">
                                                            <div class="h-5 w-14 inline-flex items-center justify-center" style="background-color: hsl({theme.preview.primary}); border-radius: {r}">
                                                                <div class="h-1 w-6" style="background-color: hsl({theme.vars.primaryForeground}); border-radius: {r}; opacity: 0.9"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <!-- Label -->
                                            <div class="px-4 py-3 flex items-center justify-between border-t" style="border-color: hsl({theme.vars.border})">
                                                <div>
                                                    <p class="font-semibold text-sm">{theme.name}</p>
                                                    <p class="text-xs text-muted-foreground mt-0.5 leading-tight">{theme.description}</p>
                                                </div>
                                                {#if isActive}
                                                    <div class="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 ml-3">
                                                        <svg class="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                                                    </div>
                                                {/if}
                                            </div>
                                        </button>
                                    {/each}
                                </div>

                                <!-- Custom CSS Editor -->
                                <details class="border border-white/10 rounded-xl overflow-hidden">
                                    <summary class="cursor-pointer px-6 py-4 text-sm font-medium flex items-center gap-2 hover:bg-muted/30 transition-colors">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                                        Custom CSS
                                        <span class="ml-1 text-xs text-muted-foreground">— nur für Theme „{themes.find(t => t.id === selectedThemeId)?.name ?? selectedThemeId}"</span>
                                        {#if currentThemeCss.trim()}
                                            <span class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                                                <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                                Aktiv
                                            </span>
                                        {:else}
                                            <span class="ml-auto text-xs text-muted-foreground">Leer</span>
                                        {/if}
                                    </summary>
                                    <div class="border-t border-white/10 p-5 space-y-3">
                                        <p class="text-xs text-muted-foreground">CSS wird nur für das aktuell gewählte Theme gespeichert und angewendet. Änderungen sind sofort als Live-Vorschau sichtbar.</p>
                                        <div class="relative">
                                            <textarea
                                                rows={16}
                                                spellcheck={false}
                                                bind:value={currentThemeCss}
                                                placeholder={'.my-class {\n  color: red;\n}\n\n/* Tipps:\n   Nutze CSS-Variablen wie var(--primary), var(--background)\n   Greife auf [data-theme="' + selectedThemeId + '"] zu für theme-spezifische Regeln\n*/'}
                                                class="w-full rounded-lg border border-input bg-[hsl(0_0%_8%)] text-[hsl(0_0%_90%)] px-4 py-3 text-[13px] font-mono leading-relaxed resize-y min-h-[280px] focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-[hsl(0_0%_40%)]"
                                            ></textarea>
                                            {#if currentThemeCss.trim()}
                                                <button
                                                    type="button"
                                                    onclick={() => currentThemeCss = ''}
                                                    class="absolute top-2 right-2 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded bg-muted/60"
                                                >
                                                    Leeren
                                                </button>
                                            {/if}
                                        </div>
                                        <p class="text-xs text-muted-foreground">Wird beim Klick auf „Einstellungen speichern" gespeichert.</p>
                                    </div>
                                </details>

                                <!-- Advanced: Custom Color Overrides -->
                                <details class="border border-white/10 rounded-xl overflow-hidden">
                                    <summary class="cursor-pointer px-6 py-4 text-sm font-medium flex items-center gap-2 hover:bg-muted/30 transition-colors">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
                                        Farben individuell anpassen
                                        <span class="ml-auto text-xs text-muted-foreground">Live-Vorschau — wird beim Speichern übernommen</span>
                                    </summary>
                                    <div class="px-6 py-5 border-t border-white/10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                        {#each [
                                            { label: 'Primary',    hsl: pickerPrimary,   hex: hexPrimary,   setHex: (v: string) => { hexPrimary   = v; pickerPrimary   = hexToHsl(v); } },
                                            { label: 'Secondary',  hsl: pickerSecondary, hex: hexSecondary, setHex: (v: string) => { hexSecondary = v; pickerSecondary = hexToHsl(v); } },
                                            { label: 'Accent',     hsl: pickerAccent,    hex: hexAccent,    setHex: (v: string) => { hexAccent    = v; pickerAccent    = hexToHsl(v); } },
                                            { label: 'Background', hsl: pickerBg,        hex: hexBg,        setHex: (v: string) => { hexBg        = v; pickerBg        = hexToHsl(v); } },
                                            { label: 'Foreground', hsl: pickerFg,        hex: hexFg,        setHex: (v: string) => { hexFg        = v; pickerFg        = hexToHsl(v); } },
                                        ] as entry}
                                            <div class="grid gap-2">
                                                <span class="text-sm font-medium">{entry.label}</span>
                                                <div class="flex items-center gap-3">
                                                    <!-- No {#key} — the input stays mounted while the user drags the wheel.
                                                         value={entry.hex} updates reactively when the theme switches. -->
                                                    <div class="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border shadow-sm shrink-0 cursor-pointer hover:scale-110 transition-transform">
                                                        <input
                                                            type="color"
                                                            class="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)] cursor-pointer opacity-0"
                                                            value={entry.hex}
                                                            oninput={(e) => entry.setHex(e.currentTarget.value)}
                                                        />
                                                        <div class="w-full h-full" style="background-color: hsl({entry.hsl})"></div>
                                                    </div>
                                                    <code class="flex-1 text-xs bg-muted/40 border border-border rounded px-2 py-1.5 font-mono truncate">{entry.hsl}</code>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </details>
                            </div>
                        </div>
                    </div>

                    <div class="px-8 py-4 bg-muted/30 border-t border-white/10 flex justify-end">
                        <Button type="submit" disabled={isSaving} class="shadow-lg shadow-primary/20">
                            {isSaving ? getT('saving') : getT('settingsSave')}
                        </Button>
                    </div>
                </form>
            </GlassCard>
            {/if}

            {#if activeTab === 'database'}
            <GlassCard variant="neo" class="p-8 space-y-8">
                <div>
                    <h2 class="text-xl font-bold">{t('dbMigrateTitle')}</h2>
                    <p class="text-sm text-muted-foreground mt-1">{t('dbMigrateDesc')}</p>
                </div>

                <!-- Current connection -->
                <div class="space-y-3">
                    <h3 class="font-semibold text-sm">{t('dbCurrentConn')}</h3>
                    <div class="rounded-xl border border-border/60 bg-card/40 p-4 space-y-3">
                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-2">
                                {#if dbOk}
                                    <CheckCircle2 class="w-4 h-4 text-green-500 shrink-0" />
                                    <span class="text-sm font-medium text-green-600 dark:text-green-400">{t('dbConnected')}</span>
                                {:else}
                                    <XCircle class="w-4 h-4 text-destructive shrink-0" />
                                    <span class="text-sm font-medium text-destructive">{t('dbConnError')}</span>
                                {/if}
                            </div>
                            <form method="POST" action="?/pingDb" use:enhance={() => {
                                    return async ({ update }) => { await update({ reset: false }); };
                                }}>
                                <Button type="submit" variant="outline" size="sm" class="gap-1.5">
                                    <RefreshCw class="w-3.5 h-3.5" /> {t('dbTestBtn')}
                                </Button>
                            </form>
                        </div>
                        <div class="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5 border border-border/40">
                            <code class="text-xs font-mono flex-1 text-foreground/80 break-all">{dbUrl}</code>
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium shrink-0">ENV</span>
                        </div>
                        {#if dbError && !dbOk}
                            <p class="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 font-mono">{dbError}</p>
                        {/if}
                        <p class="text-xs text-muted-foreground">{t('dbPasswordMasked')}</p>
                    </div>
                </div>

                <!-- New connection input -->
                <div class="space-y-3">
                    <h3 class="font-semibold text-sm">{t('dbNewConn')}</h3>
                    <div class="space-y-2">
                        <div class="flex gap-2">
                            <div class="relative flex-1">
                                <Input
                                    type={showNewDbUrl ? 'text' : 'password'}
                                    placeholder="postgresql://user:pass@host:5432/newdb"
                                    bind:value={newDbUrl}
                                    class="font-mono text-xs pr-10"
                                    oninput={() => testStatus = 'idle'}
                                />
                                <button
                                    type="button"
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    onclick={() => showNewDbUrl = !showNewDbUrl}
                                >
                                    {#if showNewDbUrl}
                                        <EyeOff class="w-4 h-4" />
                                    {:else}
                                        <Eye class="w-4 h-4" />
                                    {/if}
                                </button>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={testNewConnection}
                                disabled={!newDbUrl.trim() || testStatus === 'testing'}
                                class="gap-1.5 shrink-0"
                            >
                                <RefreshCw class="w-3.5 h-3.5 {testStatus === 'testing' ? 'animate-spin' : ''}" />
                                {t('dbTestConnBtn')}
                            </Button>
                        </div>
                        {#if testStatus === 'ok'}
                            <p class="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                                <CheckCircle2 class="w-3.5 h-3.5 shrink-0" /> {t('dbTestOk')}
                            </p>
                        {:else if testStatus === 'error'}
                            <p class="text-xs text-destructive flex items-center gap-1.5">
                                <XCircle class="w-3.5 h-3.5 shrink-0" /> {testError}
                            </p>
                        {/if}
                    </div>
                </div>

                <!-- Migration -->
                <div class="space-y-4 border-t border-border/40 pt-6">
                    <div>
                        <h3 class="font-semibold text-sm">{t('dbPortTitle')}</h3>
                        <p class="text-xs text-muted-foreground mt-1">{t('dbPortDesc')}</p>
                    </div>

                    <Button
                        onclick={startMigration}
                        disabled={testStatus !== 'ok' || migrating}
                        class="gap-2"
                    >
                        {#if migrating}
                            <RefreshCw class="w-4 h-4 animate-spin" /> {t('dbPortRunning')}
                        {:else}
                            <Database class="w-4 h-4" /> {t('dbPortStart')}
                        {/if}
                    </Button>

                    {#if migrationLog.length > 0}
                        <div class="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-1.5 font-mono text-xs max-h-72 overflow-y-auto">
                            {#each migrationLog as entry}
                                <div class="flex items-start gap-2 {entry.step === 'error' ? 'text-destructive' : entry.step === 'done' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-muted-foreground'}">
                                    {#if entry.step === 'error'}
                                        <XCircle class="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    {:else if entry.step === 'done' || entry.ok}
                                        <CheckCircle2 class="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-500" />
                                    {:else}
                                        <span class="w-3.5 shrink-0 text-center">·</span>
                                    {/if}
                                    <span>{entry.message}</span>
                                </div>
                            {/each}
                            {#if migrating}
                                <div class="flex items-center gap-2 text-muted-foreground">
                                    <RefreshCw class="w-3.5 h-3.5 animate-spin shrink-0" />
                                    <span>{t('dbPortProgress')}</span>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </GlassCard>
            {/if}
        </main>
    </div>
</PageContainer>
