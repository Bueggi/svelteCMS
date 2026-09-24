import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { enrollments } from '$lib/server/db/schema';

type EnrollmentLike = { status: string; expiresAt: Date | null } | null | undefined;

/**
 * Whether an enrollment currently grants access to its course.
 * An enrollment row alone is not enough: refunds, failed installment payments and
 * ended subscriptions keep the row (for history) but flip its status.
 */
export function hasActiveAccess(enrollment: EnrollmentLike): boolean {
    if (!enrollment || enrollment.status !== 'active') return false;
    return !enrollment.expiresAt || enrollment.expiresAt.getTime() > Date.now();
}

/** SQL counterpart of `hasActiveAccess`, for filtering enrollment queries. */
export function activeEnrollmentFilter() {
    return and(
        eq(enrollments.status, 'active'),
        or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, new Date())),
    );
}
