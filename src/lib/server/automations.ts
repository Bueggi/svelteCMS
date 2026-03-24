import { db } from '$lib/server/db';
import { automations, automationLogs } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

/** Replace {{path.to.value}} with actual values from the data object */
function substituteVars(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, path: string) => {
        const value = path.split('.').reduce((obj: any, key: string) => obj?.[key], data);
        return value !== undefined && value !== null ? String(value) : '';
    });
}

/**
 * Fire all enabled automations for a given trigger event.
 * Called fire-and-forget — errors are caught and logged, never thrown.
 */
export async function fireAutomations(event: string, data: Record<string, any>): Promise<void> {
    try {
        const triggered = await db.query.automations.findMany({
            where: and(
                eq(automations.triggerEvent, event as any),
                eq(automations.isEnabled, true),
            ),
        });

        await Promise.allSettled(triggered.map(async (automation) => {
            const payload = substituteVars(automation.bodyTemplate, data);
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            for (const { key, value } of (automation.headers ?? [])) {
                if (key.trim()) headers[key.trim()] = substituteVars(value, data);
            }

            let status: 'success' | 'error' = 'success';
            let statusCode: number | null = null;
            let responseBody: string | null = null;
            let errorMessage: string | null = null;

            try {
                const res = await fetch(automation.url, {
                    method: automation.method,
                    headers,
                    body: automation.method !== 'GET' ? payload : undefined,
                    signal: AbortSignal.timeout(10_000),
                });
                statusCode = res.status;
                responseBody = (await res.text().catch(() => null))?.slice(0, 2000) ?? null;
                if (!res.ok) {
                    status = 'error';
                    errorMessage = `HTTP ${res.status}`;
                }
            } catch (err: any) {
                status = 'error';
                errorMessage = err.message ?? 'Network error';
            }

            await db.insert(automationLogs).values({
                automationId: automation.id,
                status,
                statusCode,
                responseBody,
                errorMessage,
                payload,
            });
        }));
    } catch (err) {
        console.error('[Automations] Failed to fire event', event, err);
    }
}

/** Available variables for each trigger event — used in admin UI */
export const EVENT_VARS: Record<string, { path: string; label: string }[]> = {
    'user.created': [
        { path: 'user.id',        label: 'User ID' },
        { path: 'user.email',     label: 'E-Mail' },
        { path: 'user.name',      label: 'Name' },
        { path: 'user.createdAt', label: 'Erstellt am' },
    ],
    'enrollment.created': [
        { path: 'user.id',              label: 'User ID' },
        { path: 'user.email',           label: 'E-Mail' },
        { path: 'user.name',            label: 'Name' },
        { path: 'course.id',            label: 'Kurs-ID' },
        { path: 'course.title',         label: 'Kursname' },
        { path: 'course.slug',          label: 'Kurs-Slug' },
        { path: 'enrollment.id',        label: 'Einschreibungs-ID' },
        { path: 'enrollment.enrolledAt',label: 'Eingeschrieben am' },
    ],
    'purchase.completed': [
        { path: 'user.id',          label: 'User ID' },
        { path: 'user.email',       label: 'E-Mail' },
        { path: 'user.name',        label: 'Name' },
        { path: 'course.id',        label: 'Kurs-ID' },
        { path: 'course.title',     label: 'Kursname' },
        { path: 'purchase.id',      label: 'Kauf-ID' },
        { path: 'purchase.amount',  label: 'Betrag (Cents)' },
        { path: 'purchase.createdAt', label: 'Kaufdatum' },
    ],
    'lesson.completed': [
        { path: 'user.id',      label: 'User ID' },
        { path: 'user.email',   label: 'E-Mail' },
        { path: 'user.name',    label: 'Name' },
        { path: 'course.id',    label: 'Kurs-ID' },
        { path: 'course.title', label: 'Kursname' },
        { path: 'lesson.id',    label: 'Lektion-ID' },
        { path: 'lesson.title', label: 'Lektionsname' },
    ],
    'course.completed': [
        { path: 'user.id',      label: 'User ID' },
        { path: 'user.email',   label: 'E-Mail' },
        { path: 'user.name',    label: 'Name' },
        { path: 'course.id',    label: 'Kurs-ID' },
        { path: 'course.title', label: 'Kursname' },
        { path: 'course.slug',  label: 'Kurs-Slug' },
    ],
};

export const TRIGGER_LABELS: Record<string, string> = {
    'user.created':        'Neuer User registriert',
    'enrollment.created':  'User eingeschrieben',
    'purchase.completed':  'Kauf abgeschlossen',
    'lesson.completed':    'Lektion abgeschlossen',
    'course.completed':    'Kurs abgeschlossen',
};
