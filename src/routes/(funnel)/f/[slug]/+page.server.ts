import { db } from '$lib/server/db';
import { funnels, funnelBumps, funnelCheckoutPages } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getEnabledPaymentMethods, getVatConfig, getTaxRates } from '$lib/server/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const funnel = await db.query.funnels.findFirst({
        where: eq(funnels.slug, params.slug),
        with: {
            course: true,
            bumps: { with: { course: true }, orderBy: [asc(funnelBumps.order)] },
            checkoutPages: { orderBy: [asc(funnelCheckoutPages.order)] },
        },
    });
    if (!funnel || (!funnel.isActive && !funnel.sandboxMode)) throw error(404);

    const [enabledMethods, vatConfig, taxRateRows] = await Promise.all([
        getEnabledPaymentMethods(),
        getVatConfig(),
        getTaxRates(),
    ]);

    // Normalize bumps to upsell shape for BlockRenderer
    const bumpsAsUpsells = funnel.bumps.map((b: any) => ({
        id: b.id,
        upsellCourse: b.course,
        discountPercent: (b.specialPrice != null && b.course?.price > 0)
            ? Math.max(0, Math.round((1 - b.specialPrice / b.course.price) * 100))
            : 0,
        label: b.label,
        isActive: true,
    }));

    // First checkout page ID for CTA links
    const firstCheckoutPageId = funnel.checkoutPages[0]?.id ?? null;

    return {
        funnel,
        blocks: funnel.salesPageBlocks ? JSON.parse(funnel.salesPageBlocks) : [],
        enabledMethods,
        vatRate: vatConfig.vatRate,
        reverseChargeEnabled: vatConfig.reverseChargeEnabled,
        operatorCountry: vatConfig.companyCountry ?? 'DE',
        taxRates: taxRateRows,
        bumpsAsUpsells,
        firstCheckoutPageId,
        sandboxMode: funnel.sandboxMode,
    };
};
