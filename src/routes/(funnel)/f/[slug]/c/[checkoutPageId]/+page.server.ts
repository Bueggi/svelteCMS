import { db } from '$lib/server/db';
import { funnelBumps, funnelCheckoutPages } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import { getEnabledPaymentMethods, getVatConfig, getTaxRates, getPayPalConfig } from '$lib/server/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const [cp, enabledMethods, vatConfig, taxRateRows, paypalConfig] = await Promise.all([
        db.query.funnelCheckoutPages.findFirst({
            where: eq(funnelCheckoutPages.id, params.checkoutPageId),
            with: {
                funnel: {
                    with: {
                        course: true,
                        bumps: { with: { course: true }, orderBy: [asc(funnelBumps.order)] },
                    },
                },
            },
        }),
        getEnabledPaymentMethods(),
        getVatConfig(),
        getTaxRates(),
        getPayPalConfig(),
    ]);

    if (!cp || cp.funnel?.slug !== params.slug) throw error(404);

    const bumpsAsUpsells = (cp.funnel?.bumps ?? []).map((b: any) => ({
        id: b.id,
        upsellCourse: b.course,
        discountPercent: (b.specialPrice != null && b.course?.price > 0)
            ? Math.max(0, Math.round((1 - b.specialPrice / b.course.price) * 100))
            : 0,
        label: b.label,
        isActive: true,
    }));

    return {
        cp,
        funnel: cp.funnel,
        blocks: cp.blocks ? JSON.parse(cp.blocks) : [],
        enabledMethods,
        vatRate: vatConfig.vatRate,
        reverseChargeEnabled: vatConfig.reverseChargeEnabled,
        operatorCountry: vatConfig.companyCountry ?? 'DE',
        taxRates: taxRateRows,
        paypalClientId: paypalConfig?.clientId ?? null,
        bumpsAsUpsells,
        sandboxMode: cp.funnel?.sandboxMode ?? false,
    };
};
