<script lang="ts">
    import { enhance } from '$app/forms';
    import { PageContainer } from '$lib/components/ui/page-container';
    import { PageHeader } from '$lib/components/ui/page-header';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Zap, Webhook, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Copy, Check, RefreshCw, FlaskConical, X, AlertCircle, CheckCircle2, Clock } from 'lucide-svelte';


    let { data, form } = $props();

    let activeTab = $state<'outbound' | 'inbound'>('outbound');

    // ── Outbound form state ───────────────────────────────────────────────────
    let showOutboundForm = $state(false);
    let editingAutomation = $state<any>(null);
    let outboundHeaders = $state<{ key: string; value: string }[]>([{ key: '', value: '' }]);
    let selectedTrigger = $state('enrollment.created');
    let testResult = $state<any>(null);
    let testLoading = $state(false);
    let expandedLogs = $state<string | null>(null);
    let logData = $state<any[]>([]);
    let logLoading = $state(false);
    let copiedId = $state<string | null>(null);

    // ── Inbound form state ────────────────────────────────────────────────────
    let showInboundForm = $state(false);
    let editingInbound = $state<any>(null);
    let inboundAction = $state('enroll_user');
    let inboundCourseId = $state('');
    let inboundRole = $state('student');
    let inboundEmailSubject = $state('');
    let inboundEmailBody = $state('');
    let inboundDiscountPercent = $state(20);
    let inboundCouponPrefix = $state('WEBHOOK');
    let inboundDays = $state(30);
    let inboundLessonId = $state('');

    const INBOUND_ACTIONS = [
        { value: 'enroll_user',          label: 'User in Kurs einschreiben' },
        { value: 'unenroll_user',        label: 'User aus Kurs austragen' },
        { value: 'activate_enrollment',  label: 'Einschreibung reaktivieren' },
        { value: 'set_enrollment_expiry',label: 'Zugang befristet setzen' },
        { value: 'create_user',          label: 'Neuen User anlegen' },
        { value: 'complete_lesson',      label: 'Lektion als abgeschlossen markieren' },
        { value: 'complete_course',      label: 'Gesamten Kurs abschließen' },
        { value: 'reset_progress',       label: 'Kursfortschritt zurücksetzen' },
        { value: 'update_user_role',     label: 'Benutzerrolle ändern' },
        { value: 'send_email',           label: 'E-Mail senden' },
        { value: 'grant_coupon',         label: 'Gutscheincode erstellen' },
    ];

    const NEEDS_COURSE = ['enroll_user', 'unenroll_user', 'activate_enrollment', 'complete_course', 'reset_progress', 'set_enrollment_expiry', 'grant_coupon'];
    const PAYLOAD_HINTS: Record<string, string> = {
        enroll_user:          '{"email": "user@example.com", "courseId": "uuid (optional)"}',
        unenroll_user:        '{"email": "user@example.com", "courseId": "uuid (optional)"}',
        activate_enrollment:  '{"email": "user@example.com"}',
        set_enrollment_expiry:'{"email": "user@example.com"}',
        create_user:          '{"email": "user@example.com", "name": "Max Mustermann"}',
        complete_lesson:      '{"email": "user@example.com", "lessonId": "uuid"}',
        complete_course:      '{"email": "user@example.com"}',
        reset_progress:       '{"email": "user@example.com"}',
        update_user_role:     '{"email": "user@example.com"}',
        send_email:           '{"email": "user@example.com", "name": "Max Mustermann"}',
        grant_coupon:         '{}',
    };

    function openOutboundForm(automation?: any) {
        editingAutomation = automation ?? null;
        if (automation) {
            selectedTrigger = automation.triggerEvent;
            outboundHeaders = automation.headers?.length
                ? [...automation.headers, { key: '', value: '' }]
                : [{ key: '', value: '' }];
        } else {
            selectedTrigger = 'enrollment.created';
            outboundHeaders = [{ key: '', value: '' }];
        }
        testResult = null;
        showOutboundForm = true;
    }

    function openInboundForm(wh?: any) {
        editingInbound = wh ?? null;
        inboundAction = wh?.action ?? 'enroll_user';
        inboundCourseId = wh?.config?.courseId ?? '';
        inboundRole = wh?.config?.role ?? 'student';
        inboundEmailSubject = wh?.config?.subject ?? '';
        inboundEmailBody = wh?.config?.body ?? '';
        inboundDiscountPercent = wh?.config?.discountPercent ?? 20;
        inboundCouponPrefix = wh?.config?.prefix ?? 'WEBHOOK';
        inboundDays = wh?.config?.days ?? 30;
        inboundLessonId = wh?.config?.lessonId ?? '';
        showInboundForm = true;
    }

    function closeOutboundForm() { showOutboundForm = false; editingAutomation = null; testResult = null; }
    function closeInboundForm() { showInboundForm = false; editingInbound = null; }

    function addHeader() { outboundHeaders = [...outboundHeaders, { key: '', value: '' }]; }
    function removeHeader(i: number) { outboundHeaders = outboundHeaders.filter((_, idx) => idx !== i); }

    function insertVar(path: string) {
        const ta = document.getElementById('bodyTemplate') as HTMLTextAreaElement | null;
        if (!ta) return;
        const before = ta.value.slice(0, ta.selectionStart);
        const after = ta.value.slice(ta.selectionEnd);
        ta.value = `${before}{{${path}}}${after}`;
        ta.dispatchEvent(new Event('input'));
    }

    async function copyToClipboard(text: string, id: string) {
        await navigator.clipboard.writeText(text);
        copiedId = id;
        setTimeout(() => { if (copiedId === id) copiedId = null; }, 2000);
    }

    const currentVars = $derived((data.eventVars as any)[selectedTrigger] ?? []);

    const PRESETS = [
        {
            label: 'Slack',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{\n  "text": "{{user.name}} ({{user.email}}) — {{course.title}}"\n}',
        },
        {
            label: 'Mailchimp',
            method: 'POST',
            headers: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'Authorization', value: 'Basic DEIN_API_KEY' },
            ],
            body: '{\n  "email_address": "{{user.email}}",\n  "status": "subscribed",\n  "merge_fields": { "FNAME": "{{user.name}}" }\n}',
        },
        {
            label: 'ActiveCampaign',
            method: 'POST',
            headers: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'Api-Token', value: 'DEIN_API_KEY' },
            ],
            body: '{\n  "contact": {\n    "email": "{{user.email}}",\n    "firstName": "{{user.name}}"\n  }\n}',
        },
    ];

    function applyPreset(preset: typeof PRESETS[number]) {
        const ta = document.getElementById('bodyTemplate') as HTMLTextAreaElement | null;
        if (ta) { ta.value = preset.body; ta.dispatchEvent(new Event('input')); }
        outboundHeaders = [...preset.headers, { key: '', value: '' }];
        const methodEl = document.getElementById('method') as HTMLSelectElement | null;
        if (methodEl) methodEl.value = preset.method;
    }

    const TRIGGER_OPTIONS = [
        { value: 'user.created',       label: 'Neuer User registriert' },
        { value: 'enrollment.created', label: 'User eingeschrieben' },
        { value: 'purchase.completed', label: 'Kauf abgeschlossen' },
        { value: 'lesson.completed',   label: 'Lektion abgeschlossen' },
        { value: 'course.completed',   label: 'Kurs abgeschlossen' },
    ];
</script>

<PageContainer variant="admin">
    <PageHeader title="Automations & Webhooks" description="Verbinde dein System mit externen Diensten.">
        {#snippet actions()}
            {#if activeTab === 'outbound'}
                <Button onclick={() => openOutboundForm()}>
                    <Plus class="w-4 h-4 mr-2" /> Neue Automation
                </Button>
            {:else}
                <Button onclick={() => openInboundForm()}>
                    <Plus class="w-4 h-4 mr-2" /> Neuer Webhook
                </Button>
            {/if}
        {/snippet}
    </PageHeader>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-border/40 mb-6">
        <button
            onclick={() => activeTab = 'outbound'}
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors {activeTab === 'outbound' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
            <Zap class="w-4 h-4" /> Outbound Automations
        </button>
        <button
            onclick={() => activeTab = 'inbound'}
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors {activeTab === 'inbound' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
            <Webhook class="w-4 h-4" /> Inbound Webhooks
        </button>
    </div>

    <!-- ── OUTBOUND TAB ──────────────────────────────────────────────────────── -->
    {#if activeTab === 'outbound'}
        {#if data.automations.length === 0 && !showOutboundForm}
            <div class="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-2xl">
                <Zap class="w-10 h-10 text-muted-foreground/30 mb-4" />
                <p class="font-semibold text-foreground mb-1">Noch keine Automations</p>
                <p class="text-sm text-muted-foreground mb-6 max-w-sm">Erstelle eine Automation, um bei bestimmten Events automatisch externe APIs aufzurufen.</p>
                <Button onclick={() => openOutboundForm()}>
                    <Plus class="w-4 h-4 mr-2" /> Erste Automation erstellen
                </Button>
            </div>
        {:else}
            <!-- List -->
            <div class="space-y-2">
                {#each data.automations as automation}
                    {@const lastLog = data.logMap[automation.id]}
                    <div class="bg-card border border-border/50 rounded-xl overflow-hidden">
                        <div class="flex items-center gap-4 p-4">
                            <!-- Status dot -->
                            <div class="w-2 h-2 rounded-full shrink-0 {automation.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}"></div>

                            <div class="flex-1 min-w-0">
                                <p class="font-medium text-sm">{automation.name}</p>
                                <div class="flex items-center gap-3 mt-0.5">
                                    <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        {TRIGGER_OPTIONS.find(t => t.value === automation.triggerEvent)?.label ?? automation.triggerEvent}
                                    </span>
                                    <span class="text-xs text-muted-foreground truncate max-w-[200px]">{automation.method} {automation.url}</span>
                                </div>
                            </div>

                            <!-- Last run status -->
                            {#if lastLog}
                                <div class="flex items-center gap-1.5 text-xs {lastLog.status === 'success' ? 'text-emerald-600' : 'text-destructive'}">
                                    {#if lastLog.status === 'success'}
                                        <CheckCircle2 class="w-3.5 h-3.5" />
                                    {:else}
                                        <AlertCircle class="w-3.5 h-3.5" />
                                    {/if}
                                    {new Date(lastLog.triggeredAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            {:else}
                                <span class="text-xs text-muted-foreground/50">Noch nicht ausgeführt</span>
                            {/if}

                            <!-- Actions -->
                            <div class="flex items-center gap-1">
                                <!-- Logs toggle -->
                                <button
                                    onclick={async () => {
                                        if (expandedLogs === automation.id) { expandedLogs = null; return; }
                                        expandedLogs = automation.id;
                                        logLoading = true;
                                        const fd = new FormData();
                                        fd.set('automationId', automation.id);
                                        const res = await fetch('?/getLogs', { method: 'POST', body: fd });
                                        const result = await res.json();
                                        logData = result.data?.logs ?? [];
                                        logLoading = false;
                                    }}
                                    class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                    title="Logs anzeigen"
                                >
                                    {#if expandedLogs === automation.id}<ChevronUp class="w-4 h-4" />{:else}<ChevronDown class="w-4 h-4" />{/if}
                                </button>

                                <!-- Toggle enable -->
                                <form method="POST" action="?/toggleAutomation" use:enhance>
                                    <input type="hidden" name="id" value={automation.id} />
                                    <button type="submit" class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="{automation.isEnabled ? 'Deaktivieren' : 'Aktivieren'}">
                                        {#if automation.isEnabled}<ToggleRight class="w-4 h-4 text-emerald-500" />{:else}<ToggleLeft class="w-4 h-4" />{/if}
                                    </button>
                                </form>

                                <button onclick={() => openOutboundForm(automation)} class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium">
                                    Edit
                                </button>

                                <form method="POST" action="?/deleteAutomation" use:enhance={({ cancel }) => { if (!confirm('Automation löschen?')) cancel(); return async ({ update }) => update(); }}>
                                    <input type="hidden" name="id" value={automation.id} />
                                    <button type="submit" class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                        <Trash2 class="w-3.5 h-3.5" />
                                    </button>
                                </form>
                            </div>
                        </div>

                        <!-- Logs panel -->
                        {#if expandedLogs === automation.id}
                            <div class="border-t border-border/40 bg-muted/20 p-4">
                                {#if logLoading}
                                    <p class="text-xs text-muted-foreground">Lade Logs...</p>
                                {:else if logData.length === 0}
                                    <p class="text-xs text-muted-foreground">Noch keine Ausführungen.</p>
                                {:else}
                                    <table class="w-full text-xs">
                                        <thead>
                                            <tr class="text-muted-foreground border-b border-border/30">
                                                <th class="text-left pb-1 font-medium">Zeit</th>
                                                <th class="text-left pb-1 font-medium">Status</th>
                                                <th class="text-left pb-1 font-medium">HTTP</th>
                                                <th class="text-left pb-1 font-medium">Response</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-border/20">
                                            {#each logData as log}
                                                <tr class="py-1">
                                                    <td class="py-1.5 text-muted-foreground">{new Date(log.triggeredAt).toLocaleString('de-DE')}</td>
                                                    <td class="py-1.5">
                                                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold {log.status === 'success' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}">
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                    <td class="py-1.5 font-mono">{log.statusCode ?? '—'}</td>
                                                    <td class="py-1.5 text-muted-foreground truncate max-w-[300px]">{log.errorMessage ?? log.responseBody?.slice(0, 80) ?? '—'}</td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}

        <!-- ── Outbound form panel ──────────────────────────────────────────── -->
        {#if showOutboundForm}
            <div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-end" role="dialog">
                <div class="h-full w-full max-w-3xl bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden">
                    <!-- Header -->
                    <div class="flex items-center justify-between p-6 border-b border-border/40 shrink-0">
                        <div>
                            <h2 class="font-serif font-semibold text-lg">{editingAutomation ? 'Automation bearbeiten' : 'Neue Automation'}</h2>
                            <p class="text-sm text-muted-foreground mt-0.5">Event → API-Call konfigurieren</p>
                        </div>
                        <button onclick={closeOutboundForm} class="p-2 hover:bg-muted rounded-lg">
                            <X class="w-5 h-5" />
                        </button>
                    </div>

                    <!-- Form -->
                    <form
                        method="POST"
                        action="?/saveAutomation"
                        use:enhance={() => {
                            return async ({ update }) => {
                                await update();
                                closeOutboundForm();
                            };
                        }}
                        class="flex-1 overflow-y-auto p-6 space-y-6"
                    >
                        {#if editingAutomation}<input type="hidden" name="id" value={editingAutomation.id} />{/if}
                        <input type="hidden" name="isEnabled" value="true" />

                        <!-- Name + Trigger -->
                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <Label for="name">Name *</Label>
                                <Input id="name" name="name" value={editingAutomation?.name ?? ''} placeholder="Slack: Neuer Kauf" required />
                            </div>
                            <div class="space-y-1.5">
                                <Label for="triggerEvent">Event / Trigger *</Label>
                                <select id="triggerEvent" name="triggerEvent" bind:value={selectedTrigger}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                    {#each TRIGGER_OPTIONS as opt}
                                        <option value={opt.value} selected={opt.value === (editingAutomation?.triggerEvent ?? 'enrollment.created')}>{opt.label}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>

                        <!-- URL + Method -->
                        <div class="grid grid-cols-[1fr_auto] gap-3">
                            <div class="space-y-1.5">
                                <Label for="url">Ziel-URL *</Label>
                                <Input id="url" name="url" value={editingAutomation?.url ?? ''} placeholder="https://hooks.slack.com/services/..." required />
                            </div>
                            <div class="space-y-1.5">
                                <Label for="method">Method</Label>
                                <select id="method" name="method"
                                    class="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                    {#each ['POST', 'GET', 'PUT', 'PATCH'] as m}
                                        <option value={m} selected={m === (editingAutomation?.method ?? 'POST')}>{m}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>

                        <!-- Headers -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <Label>Headers</Label>
                                <button type="button" onclick={addHeader} class="text-xs text-primary hover:underline">+ Hinzufügen</button>
                            </div>
                            <input type="hidden" name="headers" value={JSON.stringify(outboundHeaders.filter(h => h.key.trim()))} />
                            {#each outboundHeaders as header, i}
                                <div class="flex gap-2">
                                    <Input placeholder="Authorization" bind:value={outboundHeaders[i].key} class="flex-1" />
                                    <Input placeholder="Bearer token123" bind:value={outboundHeaders[i].value} class="flex-1" />
                                    {#if outboundHeaders.length > 1}
                                        <button type="button" onclick={() => removeHeader(i)} class="p-2 hover:bg-muted rounded text-muted-foreground"><X class="w-3.5 h-3.5" /></button>
                                    {/if}
                                </div>
                            {/each}
                        </div>

                        <!-- Body template + Variable picker -->
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <Label for="bodyTemplate">Request Body (JSON)</Label>
                                <div class="flex gap-1">
                                    {#each PRESETS as preset}
                                        <button type="button" onclick={() => applyPreset(preset)}
                                            class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border border-border/50 hover:bg-muted text-muted-foreground">
                                            {preset.label}
                                        </button>
                                    {/each}
                                </div>
                            </div>

                            <div class="grid grid-cols-[1fr_auto] gap-3">
                                <textarea
                                    id="bodyTemplate"
                                    name="bodyTemplate"
                                    rows="8"
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    placeholder={'{\n  "email": "{{user.email}}",\n  "name": "{{user.name}}"\n}'}
                                >{editingAutomation?.bodyTemplate ?? '{}'}</textarea>

                                <!-- Variable pills -->
                                <div class="w-48 space-y-1 border border-border/40 rounded-lg p-3 bg-muted/20 overflow-y-auto max-h-[220px]">
                                    <p class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Verfügbare Variablen</p>
                                    {#each currentVars as v}
                                        <button type="button" onclick={() => insertVar(v.path)}
                                            class="w-full text-left group flex flex-col px-2 py-1.5 rounded hover:bg-primary/10 hover:text-primary transition-colors">
                                            <span class="text-[10px] font-mono text-primary/80">{"{{" + v.path + "}}"}</span>
                                            <span class="text-[10px] text-muted-foreground">{v.label}</span>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        </div>

                        <!-- Description (optional) -->
                        <div class="space-y-1.5">
                            <Label for="description">Beschreibung (optional)</Label>
                            <Input id="description" name="description" value={editingAutomation?.description ?? ''} placeholder="Slack-Benachrichtigung bei neuem Kauf" />
                        </div>

                        <!-- Test result -->
                        {#if testResult}
                            <div class="rounded-xl border p-4 text-sm space-y-2 {testResult.ok ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800' : 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800'}">
                                <div class="flex items-center gap-2 font-semibold {testResult.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}">
                                    {#if testResult.ok}<CheckCircle2 class="w-4 h-4" /> HTTP {testResult.status} — Erfolgreich{:else}<AlertCircle class="w-4 h-4" /> Fehler: {testResult.error ?? `HTTP ${testResult.status}`}{/if}
                                </div>
                                {#if testResult.responseBody}
                                    <pre class="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{testResult.responseBody}</pre>
                                {/if}
                                <p class="text-xs text-muted-foreground">Gesendeter Payload: <code class="font-mono">{testResult.payload?.slice(0, 200)}</code></p>
                            </div>
                        {/if}

                        <!-- Footer actions -->
                        <div class="flex items-center justify-between pt-2 border-t border-border/40">
                            <button
                                type="button"
                                disabled={testLoading}
                                class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                                onclick={async () => {
                                    testLoading = true; testResult = null;
                                    const thisForm = document.querySelector('form[action="?/saveAutomation"]') as HTMLFormElement | null;
                                    const fd = new FormData();
                                    fd.set('url', (document.getElementById('url') as HTMLInputElement)?.value ?? '');
                                    fd.set('method', (document.getElementById('method') as HTMLSelectElement)?.value ?? 'POST');
                                    fd.set('bodyTemplate', (document.getElementById('bodyTemplate') as HTMLTextAreaElement)?.value ?? '{}');
                                    fd.set('headers', JSON.stringify(outboundHeaders.filter(h => h.key.trim())));
                                    const res = await fetch('?/testAutomation', { method: 'POST', body: fd });
                                    const result = await res.json();
                                    testResult = result.data?.testResult ?? null;
                                    testLoading = false;
                                }}
                            >
                                <FlaskConical class="w-4 h-4" /> {testLoading ? 'Sende...' : 'Testen (Beispieldaten)'}
                            </button>
                            <div class="flex gap-2">
                                <Button type="button" variant="outline" onclick={closeOutboundForm}>Abbrechen</Button>
                                <Button type="submit">Speichern</Button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        {/if}
    {/if}

    <!-- ── INBOUND TAB ─────────────────────────────────────────────────────── -->
    {#if activeTab === 'inbound'}
        {#if data.inboundWebhooks.length === 0 && !showInboundForm}
            <div class="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-2xl">
                <Webhook class="w-10 h-10 text-muted-foreground/30 mb-4" />
                <p class="font-semibold text-foreground mb-1">Noch keine Inbound Webhooks</p>
                <p class="text-sm text-muted-foreground mb-6 max-w-sm">Erstelle einen Endpunkt, über den externe Dienste Aktionen in deinem System auslösen können.</p>
                <Button onclick={() => openInboundForm()}>
                    <Plus class="w-4 h-4 mr-2" /> Ersten Webhook erstellen
                </Button>
            </div>
        {:else}
            <div class="space-y-3">
                {#each data.inboundWebhooks as wh}
                    {@const webhookUrl = `/api/webhooks/in/${wh.secretToken}`}
                    <div class="bg-card border border-border/50 rounded-xl p-5 space-y-3">
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex items-center gap-3">
                                <div class="w-2 h-2 rounded-full shrink-0 mt-1 {wh.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'}"></div>
                                <div>
                                    <p class="font-medium text-sm">{wh.name}</p>
                                    <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        {wh.action === 'enroll_user' ? 'User einschreiben' : wh.action}
                                        {#if wh.config?.courseId}
                                            → {data.allCourses.find((c: any) => c.id === wh.config.courseId)?.title ?? wh.config.courseId}
                                        {/if}
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <form method="POST" action="?/toggleInbound" use:enhance>
                                    <input type="hidden" name="id" value={wh.id} />
                                    <button type="submit" class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                        {#if wh.isEnabled}<ToggleRight class="w-4 h-4 text-emerald-500" />{:else}<ToggleLeft class="w-4 h-4" />{/if}
                                    </button>
                                </form>
                                <button onclick={() => openInboundForm(wh)} class="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium">Edit</button>
                                <form method="POST" action="?/deleteInbound" use:enhance={({ cancel }) => { if (!confirm('Webhook löschen?')) cancel(); return async ({ update }) => update(); }}>
                                    <input type="hidden" name="id" value={wh.id} />
                                    <button type="submit" class="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                        <Trash2 class="w-3.5 h-3.5" />
                                    </button>
                                </form>
                            </div>
                        </div>

                        <!-- Webhook URL -->
                        <div class="space-y-1">
                            <p class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Webhook URL</p>
                            <div class="flex items-center gap-2 bg-muted/40 border border-border/40 rounded-lg px-3 py-2">
                                <code class="flex-1 text-xs font-mono truncate text-foreground/80">{webhookUrl}</code>
                                <button onclick={() => copyToClipboard(webhookUrl, wh.id + '-url')} class="text-muted-foreground hover:text-foreground shrink-0">
                                    {#if copiedId === wh.id + '-url'}<Check class="w-3.5 h-3.5 text-emerald-500" />{:else}<Copy class="w-3.5 h-3.5" />{/if}
                                </button>
                            </div>
                        </div>

                        <!-- Instructions -->
                        <div class="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 space-y-1">
                            <p class="font-medium text-foreground/70">Verwendung — POST mit <code class="font-mono bg-muted px-1 rounded">Content-Type: application/json</code></p>
                            <p>Payload: <code class="font-mono bg-muted px-1 rounded">{PAYLOAD_HINTS[wh.action] ?? '{}'}</code></p>
                        </div>

                        <form method="POST" action="?/regenerateToken" use:enhance={({ cancel }) => { if (!confirm('Secret-Token neu generieren? Die alte URL hört auf zu funktionieren.')) cancel(); return async ({ update }) => update(); }}>
                            <input type="hidden" name="id" value={wh.id} />
                            <button type="submit" class="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                                <RefreshCw class="w-3 h-3" /> Token neu generieren
                            </button>
                        </form>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- ── Inbound form ──────────────────────────────────────────────────── -->
        {#if showInboundForm}
            <div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                    <div class="flex items-center justify-between">
                        <h2 class="font-serif font-semibold text-lg">{editingInbound ? 'Webhook bearbeiten' : 'Neuer Inbound Webhook'}</h2>
                        <button onclick={closeInboundForm} class="p-1.5 hover:bg-muted rounded-lg"><X class="w-4 h-4" /></button>
                    </div>

                    <form method="POST" action="?/saveInbound" use:enhance={() => {
                        return async ({ update }) => { await update(); closeInboundForm(); };
                    }} class="space-y-4">
                        {#if editingInbound}<input type="hidden" name="id" value={editingInbound.id} />{/if}

                        <div class="space-y-1.5">
                            <Label for="inboundName">Name *</Label>
                            <Input id="inboundName" name="name" value={editingInbound?.name ?? ''} placeholder="Mailchimp → Einschreiben" required />
                        </div>

                        <div class="space-y-1.5">
                            <Label for="inboundAction">Aktion *</Label>
                            <select id="inboundAction" name="action" bind:value={inboundAction}
                                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                {#each INBOUND_ACTIONS as act}
                                    <option value={act.value}>{act.label}</option>
                                {/each}
                            </select>
                        </div>

                        <!-- Expected payload hint -->
                        <div class="text-xs bg-muted/30 border border-border/40 rounded-lg px-3 py-2 space-y-0.5">
                            <p class="font-medium text-muted-foreground">Erwarteter Payload:</p>
                            <code class="font-mono text-foreground/70">{PAYLOAD_HINTS[inboundAction] ?? '{}'}</code>
                        </div>

                        <!-- Course picker (for actions that need it) -->
                        {#if NEEDS_COURSE.includes(inboundAction) && inboundAction !== 'grant_coupon'}
                            <div class="space-y-1.5">
                                <Label for="inboundCourse">
                                    Kurs
                                    {#if inboundAction === 'enroll_user' || inboundAction === 'unenroll_user'}
                                        <span class="text-muted-foreground font-normal">(optional — Payload-<code class="font-mono text-xs">courseId</code> hat Vorrang)</span>
                                    {:else if inboundAction === 'unenroll_user'}
                                        <span class="text-muted-foreground font-normal">(optional — leer = alle Kurse)</span>
                                    {:else}
                                        *
                                    {/if}
                                </Label>
                                <select id="inboundCourse" bind:value={inboundCourseId}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="">-- Kurs wählen --</option>
                                    {#each data.allCourses as course}
                                        <option value={course.id}>{course.title}</option>
                                    {/each}
                                </select>
                            </div>
                        {/if}

                        <!-- Days (set_enrollment_expiry) -->
                        {#if inboundAction === 'set_enrollment_expiry'}
                            <div class="space-y-1.5">
                                <Label>Zugang für X Tage (ab jetzt)</Label>
                                <input type="number" min="1" bind:value={inboundDays}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="30" />
                            </div>
                        {/if}

                        <!-- Role picker (update_user_role) -->
                        {#if inboundAction === 'update_user_role'}
                            <div class="space-y-1.5">
                                <Label>Neue Rolle *</Label>
                                <select bind:value={inboundRole}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                    <option value="moderator">Moderator</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        {/if}

                        <!-- Email template (send_email) -->
                        {#if inboundAction === 'send_email'}
                            <div class="space-y-1.5">
                                <Label>Betreff *</Label>
                                <input type="text" bind:value={inboundEmailSubject}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Willkommen, {{name}}!" />
                            </div>
                            <div class="space-y-1.5">
                                <Label>E-Mail-Body (HTML) *</Label>
                                <textarea rows="5" bind:value={inboundEmailBody}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    placeholder={'<p>Hallo {{name}},</p>\n<p>...</p>'}></textarea>
                                <p class="text-[11px] text-muted-foreground">Variablen: <code class="font-mono bg-muted px-1 rounded">{'{{name}}'}</code> <code class="font-mono bg-muted px-1 rounded">{'{{email}}'}</code></p>
                            </div>
                        {/if}

                        <!-- Coupon config (grant_coupon) -->
                        {#if inboundAction === 'grant_coupon'}
                            <div class="grid grid-cols-2 gap-3">
                                <div class="space-y-1.5">
                                    <Label>Rabatt % *</Label>
                                    <input type="number" min="1" max="100" bind:value={inboundDiscountPercent}
                                        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="20" />
                                </div>
                                <div class="space-y-1.5">
                                    <Label>Code-Prefix</Label>
                                    <input type="text" bind:value={inboundCouponPrefix}
                                        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="WEBHOOK" />
                                </div>
                            </div>
                            <div class="space-y-1.5">
                                <Label>Kurs (optional – leer = alle Kurse)</Label>
                                <select bind:value={inboundCourseId}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                                    <option value="">-- Kein spezifischer Kurs --</option>
                                    {#each data.allCourses as course}
                                        <option value={course.id}>{course.title}</option>
                                    {/each}
                                </select>
                            </div>
                        {/if}

                        <!-- Lesson ID (complete_lesson) -->
                        {#if inboundAction === 'complete_lesson'}
                            <div class="space-y-1.5">
                                <Label>Lektion-ID (optional – kann auch im Payload kommen)</Label>
                                <input type="text" bind:value={inboundLessonId}
                                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="uuid der Lektion" />
                            </div>
                        {/if}

                        <!-- Hidden config JSON -->
                        {#if inboundAction === 'enroll_user' || inboundAction === 'unenroll_user' || inboundAction === 'activate_enrollment' || inboundAction === 'complete_course' || inboundAction === 'reset_progress'}
                            <input type="hidden" name="config" value={JSON.stringify({ courseId: inboundCourseId || undefined })} />
                        {:else if inboundAction === 'set_enrollment_expiry'}
                            <input type="hidden" name="config" value={JSON.stringify({ courseId: inboundCourseId, days: inboundDays })} />
                        {:else if inboundAction === 'update_user_role'}
                            <input type="hidden" name="config" value={JSON.stringify({ role: inboundRole })} />
                        {:else if inboundAction === 'send_email'}
                            <input type="hidden" name="config" value={JSON.stringify({ subject: inboundEmailSubject, body: inboundEmailBody })} />
                        {:else if inboundAction === 'grant_coupon'}
                            <input type="hidden" name="config" value={JSON.stringify({ discountPercent: inboundDiscountPercent, prefix: inboundCouponPrefix, courseId: inboundCourseId || undefined })} />
                        {:else if inboundAction === 'complete_lesson'}
                            <input type="hidden" name="config" value={JSON.stringify({ lessonId: inboundLessonId || undefined })} />
                        {:else}
                            <input type="hidden" name="config" value="{{}}" />
                        {/if}

                        <div class="flex gap-2 pt-2 border-t border-border/40">
                            <Button type="button" variant="outline" class="flex-1" onclick={closeInboundForm}>Abbrechen</Button>
                            <Button type="submit" class="flex-1">Speichern</Button>
                        </div>
                    </form>
                </div>
            </div>
        {/if}
    {/if}
</PageContainer>
