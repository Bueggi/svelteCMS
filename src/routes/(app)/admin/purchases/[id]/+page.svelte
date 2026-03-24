<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { PageContainer } from "$lib/components/ui/page-container";
    import { StatusBadge } from "$lib/components/ui/status-badge";
    import { Badge } from "$lib/components/ui/badge";
    import {
        ChevronLeft, ExternalLink, RotateCcw, AlertTriangle, RefreshCcw,
        User, CreditCard, BookOpen, Receipt, ShieldAlert, CheckCircle2,
        Clock, Copy, Check
    } from "lucide-svelte";
    import { PageTitle } from "$lib/components/ui/page-title";

    let { data, form } = $props();
    let purchase = $derived(data.purchase);
    let enrollment = $derived(data.enrollment);
    let stripeData = $derived(data.stripeData);
    let stripeError = $derived(data.stripeError);

    let isRefunding = $state(false);
    let isMarking = $state(false);
    let isRestoring = $state(false);
    let copiedId = $state('');

    function formatAmount(cents: number, currency = 'EUR') {
        return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: currency.toUpperCase() });
    }

    function formatDate(d: string | Date) {
        return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(d: string | Date) {
        const date = new Date(d);
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
            + ' · '
            + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function copyToClipboard(text: string, key: string) {
        navigator.clipboard.writeText(text);
        copiedId = key;
        setTimeout(() => (copiedId = ''), 2000);
    }

    const paymentMethodLabel: Record<string, string> = {
        card: 'Card',
        paypal: 'PayPal',
        klarna: 'Klarna',
        sofort: 'SOFORT',
        sepa_debit: 'SEPA Debit',
    };

    const cardBrandLabel: Record<string, string> = {
        visa: 'Visa',
        mastercard: 'Mastercard',
        amex: 'American Express',
        discover: 'Discover',
        jcb: 'JCB',
        unionpay: 'UnionPay',
    };
</script>

<PageContainer variant="admin" class="max-w-5xl">

    <!-- Top Bar -->
    <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
            <Button variant="ghost" size="icon" href="/admin/purchases">
                <ChevronLeft class="w-5 h-5" />
            </Button>
            <div>
                <div class="flex items-center gap-3">
                    <PageTitle class="text-2xl">Purchase</PageTitle>
                    <StatusBadge status={purchase.status} />
                </div>
                <button
                    class="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1 hover:text-foreground transition-colors"
                    onclick={() => copyToClipboard(purchase.id, 'purchaseId')}
                >
                    {purchase.id}
                    {#if copiedId === 'purchaseId'}
                        <Check class="w-3 h-3 text-green-500" />
                    {:else}
                        <Copy class="w-3 h-3 opacity-40" />
                    {/if}
                </button>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 flex-wrap">
            {#if stripeData?.paymentIntentId}
                <Button
                    variant="outline"
                    size="sm"
                    href="https://dashboard.stripe.com/payments/{stripeData.paymentIntentId}"
                    target="_blank"
                >
                    <ExternalLink class="w-4 h-4 mr-2" />
                    Stripe
                </Button>
            {/if}

            {#if purchase.status === 'completed'}
                <form method="POST" action="?/markDisputed" use:enhance={() => {
                    isMarking = true;
                    return async ({ update }) => { await update(); isMarking = false; };
                }}>
                    <Button variant="outline" size="sm" type="submit" disabled={isMarking} class="text-orange-600 border-orange-200 hover:bg-orange-50">
                        <ShieldAlert class="w-4 h-4 mr-2" />
                        {isMarking ? 'Marking…' : 'Mark Disputed'}
                    </Button>
                </form>

                <form method="POST" action="?/refundPurchase" use:enhance={({ cancel }) => {
                    if (!confirm('Issue a full refund for this purchase? This action cannot be undone.')) {
                        cancel();
                        return;
                    }
                    isRefunding = true;
                    return async ({ update }) => { await update(); isRefunding = false; };
                }}>
                    <Button variant="destructive" size="sm" type="submit" disabled={isRefunding}>
                        <RotateCcw class="w-4 h-4 mr-2" />
                        {isRefunding ? 'Refunding…' : 'Issue Refund'}
                    </Button>
                </form>
            {/if}
        </div>
    </div>

    <!-- Flash message -->
    {#if form?.message}
        <div class="p-3 rounded-md bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {form.message}
        </div>
    {/if}
    {#if form?.success}
        <div class="p-3 rounded-md bg-green-500/10 text-green-700 text-sm border border-green-200 flex items-center gap-2">
            <CheckCircle2 class="w-4 h-4" />
            {#if form.action === 'refunded'}Refund processed successfully. Enrollment has been cancelled.
            {:else if form.action === 'disputed'}Purchase marked as disputed.
            {:else if form.action === 'enrollment_restored'}Enrollment restored successfully.
            {:else}Action completed successfully.{/if}
        </div>
    {/if}

    <!-- Summary Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Transaction -->
        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader class="pb-2">
                <CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Receipt class="w-4 h-4" /> Transaction
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-3">
                <div>
                    <p class="text-xs text-muted-foreground">Amount paid</p>
                    <p class="text-2xl font-bold font-mono">{formatAmount(purchase.amount)}</p>
                </div>
                {#if stripeData?.amountDiscount && stripeData.amountDiscount > 0}
                    <div>
                        <p class="text-xs text-muted-foreground">Discount applied</p>
                        <p class="text-sm font-mono text-green-600">−{formatAmount(stripeData.amountDiscount)}</p>
                    </div>
                {/if}
                {#if stripeData?.amountTax && stripeData.amountTax > 0}
                    <div>
                        <p class="text-xs text-muted-foreground">Tax</p>
                        <p class="text-sm font-mono">{formatAmount(stripeData.amountTax)}</p>
                    </div>
                {/if}
                <div>
                    <p class="text-xs text-muted-foreground">Date</p>
                    <p class="text-sm">{formatDateTime(purchase.createdAt)}</p>
                </div>
            </CardContent>
        </Card>

        <!-- Customer -->
        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader class="pb-2">
                <CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User class="w-4 h-4" /> Customer
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-3">
                <div>
                    <p class="text-xs text-muted-foreground">Name</p>
                    <a href="/admin/users/{purchase.user.id}" class="text-sm font-medium hover:underline text-primary">
                        {purchase.user.name}
                    </a>
                </div>
                <div>
                    <p class="text-xs text-muted-foreground">Email</p>
                    <p class="text-sm truncate">{purchase.user.email}</p>
                </div>
                {#if purchase.user.stripeCustomerId}
                    <div>
                        <p class="text-xs text-muted-foreground">Stripe Customer</p>
                        <a
                            href="https://dashboard.stripe.com/customers/{purchase.user.stripeCustomerId}"
                            target="_blank"
                            class="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                        >
                            {purchase.user.stripeCustomerId.slice(0, 20)}…
                            <ExternalLink class="w-3 h-3" />
                        </a>
                    </div>
                {/if}
                {#if stripeData?.customerDetails?.phone}
                    <div>
                        <p class="text-xs text-muted-foreground">Phone</p>
                        <p class="text-sm">{stripeData.customerDetails.phone}</p>
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- Course & Enrollment -->
        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader class="pb-2">
                <CardTitle class="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BookOpen class="w-4 h-4" /> Course & Access
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-3">
                <div>
                    <p class="text-xs text-muted-foreground">Course</p>
                    <a href="/admin/courses/{purchase.course.id}" class="text-sm font-medium hover:underline text-primary line-clamp-2">
                        {purchase.course.title}
                    </a>
                </div>
                <div>
                    <p class="text-xs text-muted-foreground">Access type</p>
                    <StatusBadge status={purchase.course.accessType} />
                </div>
                {#if enrollment}
                    <div>
                        <p class="text-xs text-muted-foreground">Enrollment</p>
                        <StatusBadge status={enrollment.status} />
                    </div>
                    {#if enrollment.expiresAt}
                        <div>
                            <p class="text-xs text-muted-foreground">Expires</p>
                            <p class="text-sm flex items-center gap-1">
                                <Clock class="w-3 h-3" />
                                {formatDate(enrollment.expiresAt)}
                            </p>
                        </div>
                    {/if}
                {:else}
                    <p class="text-xs text-muted-foreground italic">No enrollment record found</p>
                {/if}
            </CardContent>
        </Card>
    </div>

    <!-- Payment Details -->
    {#if stripeData}
        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <CreditCard class="w-5 h-5" /> Payment Details
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Payment method -->
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Method</p>
                        <p class="text-sm font-medium">{paymentMethodLabel[stripeData.paymentMethodType ?? ''] ?? stripeData.paymentMethodType ?? '—'}</p>
                        {#if stripeData.card}
                            <p class="text-sm text-muted-foreground">
                                {cardBrandLabel[stripeData.card.brand] ?? stripeData.card.brand}
                                •••• {stripeData.card.last4}
                                <span class="text-xs ml-1 opacity-60">{stripeData.card.expMonth}/{stripeData.card.expYear}</span>
                            </p>
                        {/if}
                        {#if stripeData.paypal}
                            <p class="text-sm text-muted-foreground">{stripeData.paypal.payerEmail ?? 'PayPal'}</p>
                        {/if}
                    </div>

                    <!-- Payment status -->
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Payment Status</p>
                        <Badge variant={stripeData.paymentStatus === 'succeeded' ? 'default' : 'secondary'} class="capitalize">
                            {stripeData.paymentStatus ?? '—'}
                        </Badge>
                    </div>

                    <!-- Stripe Session ID -->
                    <div class="space-y-1">
                        <p class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Session ID</p>
                        <button
                            class="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-left"
                            onclick={() => copyToClipboard(purchase.stripeCheckoutSessionId, 'sessionId')}
                        >
                            {purchase.stripeCheckoutSessionId.slice(0, 22)}…
                            {#if copiedId === 'sessionId'}
                                <Check class="w-3 h-3 text-green-500" />
                            {:else}
                                <Copy class="w-3 h-3 opacity-40" />
                            {/if}
                        </button>
                    </div>

                    <!-- Billing address -->
                    {#if stripeData.billingDetails?.address || stripeData.customerDetails?.address}
                        {@const addr = stripeData.billingDetails?.address ?? stripeData.customerDetails?.address}
                        <div class="space-y-1">
                            <p class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Billing Address</p>
                            <div class="text-sm text-muted-foreground leading-relaxed">
                                {#if addr?.line1}<p>{addr.line1}</p>{/if}
                                {#if addr?.line2}<p>{addr.line2}</p>{/if}
                                {#if addr?.city || addr?.postal_code}
                                    <p>{[addr.postal_code, addr.city].filter(Boolean).join(' ')}</p>
                                {/if}
                                {#if addr?.country}<p>{addr.country}</p>{/if}
                            </div>
                        </div>
                    {/if}

                    <!-- Tax IDs -->
                    {#if stripeData.customerDetails?.tax_ids && stripeData.customerDetails.tax_ids.length > 0}
                        <div class="space-y-1">
                            <p class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tax ID</p>
                            {#each stripeData.customerDetails.tax_ids as tid}
                                <p class="text-sm font-mono">{tid.type?.toUpperCase()}: {tid.value}</p>
                            {/each}
                        </div>
                    {/if}

                    <!-- Discounts -->
                    {#if stripeData.discounts.length > 0}
                        <div class="space-y-1">
                            <p class="text-xs text-muted-foreground uppercase tracking-wider font-medium">Coupon Applied</p>
                            {#each stripeData.discounts as d}
                                <p class="text-sm font-mono">{d.code ?? 'Discount'} — −{formatAmount(d.amount)}</p>
                            {/each}
                        </div>
                    {/if}
                </div>
            </CardContent>
        </Card>

        <!-- Refund History -->
        {#if stripeData.refunds.length > 0}
            <Card class="bg-card/50 backdrop-blur border shadow-sm">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <RotateCcw class="w-5 h-5" /> Refund History
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="divide-y divide-border/50">
                        {#each stripeData.refunds as refund}
                            <div class="py-3 flex items-center justify-between gap-4">
                                <div class="space-y-0.5">
                                    <p class="text-sm font-mono text-muted-foreground">{refund.id}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {new Date(refund.created * 1000).toLocaleDateString('de-DE')}
                                        {#if refund.reason} · {refund.reason}{/if}
                                    </p>
                                </div>
                                <div class="text-right shrink-0">
                                    <p class="text-sm font-mono font-medium">−{formatAmount(refund.amount)}</p>
                                    <Badge variant={refund.status === 'succeeded' ? 'default' : 'secondary'} class="text-[10px] capitalize">
                                        {refund.status}
                                    </Badge>
                                </div>
                            </div>
                        {/each}
                    </div>
                </CardContent>
            </Card>
        {/if}

    {:else if stripeError}
        <Card class="bg-orange-50/50 border-orange-200 dark:bg-orange-950/20">
            <CardContent class="pt-6 flex items-center gap-3 text-orange-700 dark:text-orange-300">
                <AlertTriangle class="w-5 h-5 shrink-0" />
                <div>
                    <p class="font-medium text-sm">Could not load Stripe data</p>
                    <p class="text-xs mt-0.5 opacity-70">{stripeError}</p>
                </div>
            </CardContent>
        </Card>
    {/if}

    <!-- Enrollment Management -->
    {#if enrollment?.status === 'cancelled' || purchase.status === 'refunded'}
        <Card class="bg-card/50 backdrop-blur border shadow-sm">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <RefreshCcw class="w-5 h-5" /> Restore Access
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p class="text-sm text-muted-foreground mb-4">
                    The enrollment for this purchase is cancelled. You can manually restore access, for example if the dispute was resolved in the customer's favour, or as a goodwill gesture.
                </p>
                <form method="POST" action="?/restoreEnrollment" use:enhance={() => {
                    isRestoring = true;
                    return async ({ update }) => { await update(); isRestoring = false; };
                }} class="flex items-end gap-3 flex-wrap">
                    {#if purchase.course.accessType === 'duration'}
                        <div class="space-y-1">
                            <label for="expiresAt" class="text-xs font-medium text-muted-foreground">New expiry date (optional)</label>
                            <input
                                type="datetime-local"
                                id="expiresAt"
                                name="expiresAt"
                                class="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    {/if}
                    <Button type="submit" variant="secondary" disabled={isRestoring}>
                        <CheckCircle2 class="w-4 h-4 mr-2" />
                        {isRestoring ? 'Restoring…' : 'Restore Enrollment'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    {/if}

</PageContainer>
