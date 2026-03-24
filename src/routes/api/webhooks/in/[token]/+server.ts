import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { inboundWebhooks, inboundWebhookLogs, enrollments, userProgress, coupons, user, lessons, courses } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { sendMail } from '$lib/server/email/mailer';
import type { RequestHandler } from './$types';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ params, request }) => {
    const { token } = params;

    const webhook = await db.query.inboundWebhooks.findFirst({
        where: eq(inboundWebhooks.secretToken, token),
    });

    if (!webhook) return error(404, 'Webhook not found');
    if (!webhook.isEnabled) return error(403, 'Webhook is disabled');

    let payload: Record<string, any> = {};
    try {
        payload = await request.json();
    } catch { /* ignore */ }

    let resultMessage: string | null = null;
    let status: 'success' | 'error' = 'success';

    try {
        const cfg = webhook.config ?? {};
        const email = (payload?.email as string | undefined)?.toLowerCase().trim();

        // Helper: resolve user by email (throws if not found)
        async function requireUser(e: string | undefined) {
            if (!e) throw new Error('Payload missing required field: email');
            const u = await db.query.user.findFirst({ where: eq(user.email, e) });
            if (!u) throw new Error(`No user found with email: ${e}`);
            return u;
        }

        switch (webhook.action) {
            // ── Enroll user in a course ──────────────────────────────────────────
            // courseId: payload.courseId takes priority over config.courseId
            case 'enroll_user': {
                const courseId = (payload?.courseId as string | undefined) ?? (cfg.courseId as string | undefined);
                if (!courseId) throw new Error('courseId required — provide in payload or configure in webhook settings');
                const u = await requireUser(email);
                await db.insert(enrollments)
                    .values({ userId: u.id, courseId, status: 'active' })
                    .onConflictDoNothing();
                resultMessage = `User ${email} enrolled in ${courseId}`;
                break;
            }

            // ── Cancel enrollment (soft-delete) ──────────────────────────────────
            // courseId: payload.courseId takes priority over config.courseId; omit both = all courses
            case 'unenroll_user': {
                const courseId = (payload?.courseId as string | undefined) ?? (cfg.courseId as string | undefined);
                const u = await requireUser(email);
                if (courseId) {
                    await db.update(enrollments)
                        .set({ status: 'cancelled' })
                        .where(and(eq(enrollments.userId, u.id), eq(enrollments.courseId, courseId)));
                    resultMessage = `User ${email} unenrolled from ${courseId}`;
                } else {
                    await db.update(enrollments)
                        .set({ status: 'cancelled' })
                        .where(eq(enrollments.userId, u.id));
                    resultMessage = `User ${email} unenrolled from all courses`;
                }
                break;
            }

            // ── Re-activate a cancelled enrollment ───────────────────────────────
            case 'activate_enrollment': {
                const courseId = cfg.courseId as string;
                if (!courseId) throw new Error('Config missing: courseId');
                const u = await requireUser(email);
                await db.update(enrollments)
                    .set({ status: 'active' })
                    .where(and(eq(enrollments.userId, u.id), eq(enrollments.courseId, courseId)));
                resultMessage = `Enrollment for ${email} reactivated in ${courseId}`;
                break;
            }

            // ── Create a new user account ─────────────────────────────────────────
            case 'create_user': {
                if (!email) throw new Error('Payload missing required field: email');
                const name = (payload?.name as string | undefined)?.trim() || 'Student';
                const existing = await db.query.user.findFirst({ where: eq(user.email, email) });
                if (existing) {
                    resultMessage = `User ${email} already exists (skipped)`;
                } else {
                    const id = crypto.randomUUID();
                    await db.insert(user).values({
                        id, email, name, emailVerified: false, role: 'student',
                        createdAt: new Date(), updatedAt: new Date(),
                    });
                    resultMessage = `User ${email} created`;
                }
                break;
            }

            // ── Mark a specific lesson as complete ────────────────────────────────
            case 'complete_lesson': {
                const lessonId = (payload?.lessonId ?? cfg.lessonId) as string | undefined;
                if (!lessonId) throw new Error('Payload missing: lessonId');
                const u = await requireUser(email);
                await db.insert(userProgress)
                    .values({ userId: u.id, lessonId, isCompleted: true, completedAt: new Date() })
                    .onConflictDoNothing();
                resultMessage = `Lesson ${lessonId} marked complete for ${email}`;
                break;
            }

            // ── Mark every lesson in a course complete ────────────────────────────
            case 'complete_course': {
                const courseId = cfg.courseId as string;
                if (!courseId) throw new Error('Config missing: courseId');
                const u = await requireUser(email);
                const course = await db.query.courses.findFirst({
                    where: eq(courses.id, courseId),
                    with: { modules: { with: { lessons: true } } },
                }) as any;
                if (!course) throw new Error(`Course ${courseId} not found`);
                const allLessonIds: string[] = course.modules.flatMap((m: any) => m.lessons.map((l: any) => l.id));
                for (const lessonId of allLessonIds) {
                    await db.insert(userProgress)
                        .values({ userId: u.id, lessonId, isCompleted: true, completedAt: new Date() })
                        .onConflictDoNothing();
                }
                resultMessage = `All ${allLessonIds.length} lessons in ${course.title} marked complete for ${email}`;
                break;
            }

            // ── Reset progress for a course ───────────────────────────────────────
            case 'reset_progress': {
                const courseId = cfg.courseId as string;
                if (!courseId) throw new Error('Config missing: courseId');
                const u = await requireUser(email);
                const course = await db.query.courses.findFirst({
                    where: eq(courses.id, courseId),
                    with: { modules: { with: { lessons: true } } },
                }) as any;
                if (!course) throw new Error(`Course ${courseId} not found`);
                const allLessonIds: string[] = course.modules.flatMap((m: any) => m.lessons.map((l: any) => l.id));
                if (allLessonIds.length > 0) {
                    await db.delete(userProgress)
                        .where(and(eq(userProgress.userId, u.id), inArray(userProgress.lessonId, allLessonIds)));
                }
                resultMessage = `Progress reset for ${email} in ${course.title}`;
                break;
            }

            // ── Change user role ──────────────────────────────────────────────────
            case 'update_user_role': {
                const role = cfg.role as string;
                const validRoles = ['student', 'instructor', 'moderator', 'admin'];
                if (!role || !validRoles.includes(role)) throw new Error(`Config has invalid role: "${role}". Valid: ${validRoles.join(', ')}`);
                const u = await requireUser(email);
                await db.update(user).set({ role: role as any }).where(eq(user.id, u.id));
                resultMessage = `Role of ${email} updated to ${role}`;
                break;
            }

            // ── Send a custom email ───────────────────────────────────────────────
            case 'send_email': {
                const subject = cfg.subject as string | undefined;
                const body = cfg.body as string | undefined;
                if (!subject || !body) throw new Error('Config missing: subject and/or body');
                if (!email) throw new Error('Payload missing required field: email');
                // Substitute {{name}} and {{email}} from payload
                const name = (payload?.name as string | undefined) ?? email;
                const rendered = body
                    .replace(/\{\{name\}\}/g, name)
                    .replace(/\{\{email\}\}/g, email);
                await sendMail({ to: email, subject, html: rendered });
                resultMessage = `Email "${subject}" sent to ${email}`;
                break;
            }

            // ── Create a coupon code ──────────────────────────────────────────────
            case 'grant_coupon': {
                const discountPercent = Number(cfg.discountPercent ?? 0);
                if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
                    throw new Error('Config missing or invalid: discountPercent (1–100)');
                }
                const courseId = cfg.courseId as string | undefined;
                const prefix = (cfg.prefix as string | undefined) ?? 'WEBHOOK';
                const code = `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                await db.insert(coupons).values({
                    code,
                    discountType: 'percentage',
                    discountValue: discountPercent,
                    applicableTo: courseId ? 'specific_course' : 'all',
                    courseId: courseId ?? null,
                    isActive: true,
                });
                resultMessage = `Coupon ${code} created (${discountPercent}% off${courseId ? ` course ${courseId}` : ''})`;
                break;
            }

            // ── Set enrollment expiry date ────────────────────────────────────────
            case 'set_enrollment_expiry': {
                const courseId = cfg.courseId as string;
                if (!courseId) throw new Error('Config missing: courseId');
                const days = Number(cfg.days);
                if (!days || days < 1) throw new Error('Config missing or invalid: days (must be ≥ 1)');
                const u = await requireUser(email);
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + days);
                await db.update(enrollments)
                    .set({ expiresAt })
                    .where(and(eq(enrollments.userId, u.id), eq(enrollments.courseId, courseId)));
                resultMessage = `Enrollment for ${email} expires in ${days} days (${expiresAt.toISOString().slice(0, 10)})`;
                break;
            }

            default:
                throw new Error(`Unknown action: ${webhook.action}`);
        }
    } catch (err: any) {
        status = 'error';
        resultMessage = err.message ?? 'Unknown error';
    }

    await db.insert(inboundWebhookLogs).values({
        webhookId: webhook.id,
        payload: JSON.stringify(payload),
        status,
        errorMessage: status === 'error' ? resultMessage : null,
    }).catch((e) => console.error('[InboundWebhook] Failed to log:', e));

    if (status === 'error') return json({ ok: false, error: resultMessage }, { status: 400 });
    return json({ ok: true, message: resultMessage });
};
