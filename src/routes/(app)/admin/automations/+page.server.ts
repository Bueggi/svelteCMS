import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { automations, automationLogs, inboundWebhooks, inboundWebhookLogs, enrollments, user, courses } from '$lib/server/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { EVENT_VARS } from '$lib/server/automations';
import type { PageServerLoad, Actions } from './$types';
import crypto from 'crypto';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'admin') throw redirect(302, '/admin');

    const [allAutomations, allInbound] = await Promise.all([
        db.query.automations.findMany({ orderBy: [desc(automations.createdAt)] }),
        db.query.inboundWebhooks.findMany({ orderBy: [desc(inboundWebhooks.createdAt)] }),
    ]);

    // Load last run status per automation
    const logMap: Record<string, { status: string; triggeredAt: Date } | null> = {};
    for (const a of allAutomations) {
        const last = await db.query.automationLogs.findFirst({
            where: eq(automationLogs.automationId, a.id),
            orderBy: [desc(automationLogs.triggeredAt)],
        });
        logMap[a.id] = last ? { status: last.status, triggeredAt: last.triggeredAt } : null;
    }

    // Load courses for inbound enroll_user config picker
    const allCourses = await db.query.courses.findMany({
        columns: { id: true, title: true },
        orderBy: [courses.title],
    });

    return { automations: allAutomations, logMap, inboundWebhooks: allInbound, allCourses, eventVars: EVENT_VARS };
};

export const actions: Actions = {
    // ── Outbound: create / update ─────────────────────────────────────────────
    saveAutomation: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();

        const id = fd.get('id') as string | null;
        const name = (fd.get('name') as string)?.trim();
        const description = (fd.get('description') as string)?.trim() || null;
        const triggerEvent = fd.get('triggerEvent') as string;
        const url = (fd.get('url') as string)?.trim();
        const method = (fd.get('method') as string) || 'POST';
        const bodyTemplate = (fd.get('bodyTemplate') as string) || '{}';
        const headersRaw = (fd.get('headers') as string) || '[]';
        const isEnabled = fd.get('isEnabled') === 'true';

        if (!name || !triggerEvent || !url) return fail(400, { message: 'Name, Event und URL sind Pflichtfelder.' });

        let headers: { key: string; value: string }[] = [];
        try { headers = JSON.parse(headersRaw); } catch { /* ignore */ }

        if (id) {
            await db.update(automations).set({ name, description, triggerEvent: triggerEvent as any, url, method, headers, bodyTemplate, isEnabled, updatedAt: new Date() }).where(eq(automations.id, id));
        } else {
            await db.insert(automations).values({ name, description, triggerEvent: triggerEvent as any, url, method, headers, bodyTemplate, isEnabled });
        }
        return { success: true };
    },

    deleteAutomation: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        const id = fd.get('id') as string;
        await db.delete(automations).where(eq(automations.id, id));
        return { success: true };
    },

    toggleAutomation: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        const id = fd.get('id') as string;
        const current = await db.query.automations.findFirst({ where: eq(automations.id, id) });
        if (!current) return fail(404);
        await db.update(automations).set({ isEnabled: !current.isEnabled }).where(eq(automations.id, id));
        return { success: true };
    },

    testAutomation: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        const url = (fd.get('url') as string)?.trim();
        const method = (fd.get('method') as string) || 'POST';
        const bodyTemplate = (fd.get('bodyTemplate') as string) || '{}';
        const headersRaw = (fd.get('headers') as string) || '[]';

        // Sample data for preview
        const sampleData = {
            user: { id: 'usr_preview', email: 'test@example.com', name: 'Max Mustermann', createdAt: new Date().toISOString() },
            course: { id: 'crs_preview', title: 'Beispiel-Kurs', slug: 'beispiel-kurs' },
            enrollment: { id: 'enr_preview', enrolledAt: new Date().toISOString() },
            purchase: { id: 'pur_preview', amount: 4900, createdAt: new Date().toISOString() },
            lesson: { id: 'les_preview', title: 'Einführung' },
        };

        function sub(s: string) {
            return s.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
                const v = path.split('.').reduce((o: any, k: string) => o?.[k], sampleData);
                return v !== undefined ? String(v) : '';
            });
        }

        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
            for (const { key, value } of JSON.parse(headersRaw)) {
                if (key?.trim()) headers[key.trim()] = sub(value);
            }
        } catch { /* ignore */ }

        const payload = sub(bodyTemplate);

        try {
            const res = await fetch(url, {
                method,
                headers,
                body: method !== 'GET' ? payload : undefined,
                signal: AbortSignal.timeout(10_000),
            });
            const responseBody = (await res.text().catch(() => '')).slice(0, 1000);
            return { testResult: { ok: res.ok, status: res.status, responseBody, payload } };
        } catch (err: any) {
            return { testResult: { ok: false, status: null, responseBody: null, payload, error: err.message } };
        }
    },

    getLogs: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        const automationId = fd.get('automationId') as string;
        const logs = await db.query.automationLogs.findMany({
            where: eq(automationLogs.automationId, automationId),
            orderBy: [desc(automationLogs.triggeredAt)],
            limit: 20,
        });
        return { logs };
    },

    // ── Inbound: create ───────────────────────────────────────────────────────
    saveInbound: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        const id = fd.get('id') as string | null;
        const name = (fd.get('name') as string)?.trim();
        const action = fd.get('action') as string;
        const configRaw = (fd.get('config') as string) || '{}';
        const isEnabled = fd.get('isEnabled') !== 'false';

        if (!name || !action) return fail(400, { message: 'Name und Aktion sind Pflichtfelder.' });
        let config: Record<string, any> = {};
        try { config = JSON.parse(configRaw); } catch { /* ignore */ }

        if (id) {
            await db.update(inboundWebhooks).set({ name, action: action as any, config, isEnabled }).where(eq(inboundWebhooks.id, id));
        } else {
            const secretToken = crypto.randomBytes(32).toString('hex');
            await db.insert(inboundWebhooks).values({ name, action: action as any, config, secretToken });
        }
        return { success: true };
    },

    deleteInbound: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        await db.delete(inboundWebhooks).where(eq(inboundWebhooks.id, fd.get('id') as string));
        return { success: true };
    },

    toggleInbound: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        const id = fd.get('id') as string;
        const current = await db.query.inboundWebhooks.findFirst({ where: eq(inboundWebhooks.id, id) });
        if (!current) return fail(404);
        await db.update(inboundWebhooks).set({ isEnabled: !current.isEnabled }).where(eq(inboundWebhooks.id, id));
        return { success: true };
    },

    regenerateToken: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') return fail(403);
        const fd = await request.formData();
        const id = fd.get('id') as string;
        const secretToken = crypto.randomBytes(32).toString('hex');
        await db.update(inboundWebhooks).set({ secretToken }).where(eq(inboundWebhooks.id, id));
        return { success: true };
    },
};
