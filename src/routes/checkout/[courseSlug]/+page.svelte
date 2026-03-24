<script lang="ts">
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Badge } from '$lib/components/ui/badge';
    import { FormSelect } from '$lib/components/ui/form-select';
    import { ShoppingCart, Tag, CheckCircle2, Plus, ArrowRight, Lock, Info, X } from 'lucide-svelte';
    import PageBlocks from '$lib/blocks/PageBlocks.svelte';
    import type { Block } from '$lib/blocks/types';

    let { data } = $props();
    let course = $derived(data.course);
    let upsells = $derived(data.upsells);
    let user = $derived(data.user);
    let defaultVatRate = $derived(data.vatRate ?? 0);
    let reverseChargeEnabled = $derived(data.reverseChargeEnabled ?? false);
    let operatorCountry = $derived(data.operatorCountry ?? 'DE');

    // Upsell & coupon state
    let selectedUpsells = $state<Record<string, boolean>>({});
    let couponCode = $state('');
    let couponLoading = $state(false);
    let couponError = $state('');
    let appliedCoupon = $state<{ code: string; discountType: 'percentage' | 'amount'; discountValue: number } | null>(null);
    let isLoading = $state(false);

    // Billing info
    let billingName = $state(user?.name ?? '');
    let billingEmail = $state(user?.email ?? '');
    let billingStreet = $state('');
    let billingCity = $state('');
    let billingZip = $state('');
    let billingCountry = $state('DE');

    // Reverse charge (B2B)
    let isBusiness = $state(false);
    let billingVatId = $state('');

    // Derived: is reverse charge applicable?
    // RC applies when enabled + user declares as business + VAT ID starts with a different EU country code
    const EU_COUNTRIES = ['AT','BE','BG','CY','CZ','DK','EE','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];
    let reverseChargeApplies = $derived(
        reverseChargeEnabled &&
        isBusiness &&
        billingVatId.trim().length >= 4 &&
        EU_COUNTRIES.includes(billingVatId.trim().slice(0, 2).toUpperCase()) &&
        billingVatId.trim().slice(0, 2).toUpperCase() !== operatorCountry.toUpperCase()
    );

    // Non-EU buyer: no EU VAT jurisdiction (different from RC)
    const isNonEU = $derived(
        reverseChargeEnabled &&
        !EU_COUNTRIES.includes(billingCountry) &&
        billingCountry !== operatorCountry.toUpperCase()
    );

    // Effective VAT rate:
    //   RC disabled → always global defaultVatRate
    //   RC enabled + non-EU → 0% (no EU tax jurisdiction)
    //   RC enabled + EU B2B different country → 0% (Reverse Charge §13b)
    //   RC enabled + everything else → per-country table rate or global fallback
    let vatRate = $derived.by(() => {
        if (!reverseChargeEnabled) return defaultVatRate;
        if (isNonEU || reverseChargeApplies) return 0;
        return (data.taxRates ?? []).find((r: any) => r.countryCode === billingCountry && r.isEnabled)?.rate ?? defaultVatRate;
    });

    // Payment method
    const STRIPE_METHODS = ['card', 'sepa_debit', 'klarna', 'link', 'sofort'];
    const METHOD_META: Record<string, { label: string; sub: string }> = {
        card:       { label: 'Kreditkarte',   sub: 'inkl. Apple & Google Pay' },
        sepa_debit: { label: 'SEPA',          sub: 'Bankeinzug' },
        klarna:     { label: 'Klarna',        sub: 'Ratenkauf / Rechnung' },
        link:       { label: 'Link',          sub: '1-Click Checkout' },
        sofort:     { label: 'SOFORT',        sub: 'Sofortüberweisung' },
        paypal:     { label: 'PayPal',        sub: 'PayPal-Konto oder Karte' },
    };

    const availableMethods = $derived(
        data.enabledMethods
            .filter((m: string) => STRIPE_METHODS.includes(m) || (m === 'paypal' && !!data.paypalClientId))
            .map((m: string) => ({ id: m, ...(METHOD_META[m as keyof typeof METHOD_META] ?? { label: m, sub: '' }) }))
    );

    let selectedMethod = $state<string>(
        data.enabledMethods.find((m: string) => STRIPE_METHODS.includes(m)) ??
        data.enabledMethods[0] ??
        'card'
    );
    const isStripeMethod = $derived(STRIPE_METHODS.includes(selectedMethod));
    const hasPayPal = $derived(data.enabledMethods.includes('paypal') && !!data.paypalClientId);

    // PayPal
    let paypalLoaded = $state(false);
    let paypalContainer = $state<HTMLElement | null>(null);

    onMount(() => {
        if (hasPayPal && data.paypalClientId) {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${data.paypalClientId}&currency=EUR&components=buttons`;
            script.onload = () => { paypalLoaded = true; };
            document.head.appendChild(script);
        }
    });

    $effect(() => {
        if (paypalLoaded && selectedMethod === 'paypal' && paypalContainer && (window as any).paypal) {
            paypalContainer.innerHTML = '';
            (window as any).paypal.Buttons({
                createOrder: async () => {
                    const selectedUpsellIds = Object.entries(selectedUpsells).filter(([, v]) => v).map(([id]) => id);
                    const res = await fetch('/api/paypal/create-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ courseId: course.id, upsellIds: selectedUpsellIds }),
                    });
                    return (await res.json()).id;
                },
                onApprove: async (approveData: any) => {
                    isLoading = true;
                    const selectedUpsellIds = Object.entries(selectedUpsells).filter(([, v]) => v).map(([id]) => id);
                    const res = await fetch('/api/paypal/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: approveData.orderID, courseId: course.id, upsellIds: selectedUpsellIds }),
                    });
                    const result = await res.json();
                    if (result.success) window.location.href = `/thank-you?course=${result.courseSlug}`;
                    else { couponError = 'PayPal-Zahlung fehlgeschlagen.'; isLoading = false; }
                },
                onError: () => { couponError = 'PayPal-Fehler. Bitte erneut versuchen.'; },
            }).render(paypalContainer);
        }
    });

    // Price helpers
    function formatPrice(cents: number) {
        return (cents / 100).toFixed(2).replace('.', ',');
    }

    function getUpsellPrice(upsell: any) {
        const base = upsell.upsellCourse.price;
        return upsell.discountPercent > 0 ? Math.round(base * (1 - upsell.discountPercent / 100)) : base;
    }

    // Gross total before discount
    let grossTotal = $derived(
        upsells.reduce(
            (total: number, upsell: any) => total + (selectedUpsells[upsell.id] ? getUpsellPrice(upsell) : 0),
            course.price
        )
    );

    // Coupon discount amount (in cents)
    let discountAmount = $derived(
        !appliedCoupon ? 0
        : appliedCoupon.discountType === 'percentage'
            ? Math.round(grossTotal * appliedCoupon.discountValue / 100)
            : Math.min(grossTotal, appliedCoupon.discountValue)
    );

    // Gross after discount
    let discountedGross = $derived(Math.max(0, grossTotal - discountAmount));

    // Net total (excl. VAT) — calculated from discounted gross
    let netTotal = $derived(
        vatRate > 0 ? Math.round(discountedGross / (1 + vatRate / 100)) : discountedGross
    );

    // VAT amount
    let vatAmount = $derived(discountedGross - netTotal);

    // Amount actually charged (net if reverse charge, discounted gross otherwise)
    let chargeTotal = $derived(reverseChargeApplies ? netTotal : discountedGross);

    async function applyCoupon() {
        const code = couponCode.trim();
        if (!code) return;
        couponLoading = true;
        couponError = '';
        try {
            const res = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, courseId: course.id }),
            });
            const result = await res.json();
            if (result.valid) {
                appliedCoupon = { code: result.code, discountType: result.discountType, discountValue: result.discountValue };
                couponError = '';
            } else {
                couponError = result.message;
                appliedCoupon = null;
            }
        } catch {
            couponError = 'Fehler beim Prüfen des Codes.';
        } finally {
            couponLoading = false;
        }
    }

    async function handleCheckout() {
        isLoading = true;
        couponError = '';

        const selectedUpsellIds = Object.entries(selectedUpsells)
            .filter(([, checked]) => checked)
            .map(([id]) => id);

        const billingAddress = {
            name: billingName.trim(),
            email: billingEmail.trim(),
            street: billingStreet.trim(),
            city: billingCity.trim(),
            zip: billingZip.trim(),
            country: billingCountry,
            vatId: (isBusiness && billingVatId.trim()) ? billingVatId.trim() : undefined,
        };

        try {
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId: course.id,
                    upsellIds: selectedUpsellIds,
                    couponCode: couponCode.trim() || undefined,
                    selectedMethod: isStripeMethod ? selectedMethod : undefined,
                    reverseCharge: reverseChargeApplies,
                    billingAddress,
                })
            });

            const result = await response.json();

            if (!response.ok) {
                couponError = result.message || 'Checkout fehlgeschlagen. Bitte versuche es erneut.';
                isLoading = false;
                return;
            }

            if (result.url) window.location.href = result.url;
        } catch {
            couponError = 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
            isLoading = false;
        }
    }
</script>

<div class="min-h-screen bg-background">
    {#if course.checkoutBlocks}
        {@const checkoutBlocksParsed = JSON.parse(course.checkoutBlocks) as Block[]}
        {#if checkoutBlocksParsed.length > 0}
            <div class="border-b border-border/30">
                <PageBlocks blocks={checkoutBlocksParsed} courseSlug={course.slug} coursePrice={course.price} courseTitle={course.title} courseThumbnailUrl={course.thumbnailUrl ?? undefined} courseId={course.id} courseUpsells={upsells} enabledMethods={data.enabledMethods} paypalClientId={data.paypalClientId} vatRate={data.vatRate} reverseChargeEnabled={data.reverseChargeEnabled} operatorCountry={data.operatorCountry} taxRates={data.taxRates} />
            </div>
        {/if}
    {/if}
    <div class="max-w-4xl mx-auto px-4 py-12">
        <!-- Header -->
        <div class="text-center mb-10">
            <div class="inline-flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Lock class="w-4 h-4" />
                <span>Sicherer Checkout</span>
            </div>
            <h1 class="text-3xl font-serif font-bold tracking-tight">Bestellung abschließen</h1>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <!-- Left: Order Summary + Upsells -->
            <div class="lg:col-span-3 space-y-6">
                <!-- Main Course -->
                <div class="bg-card border rounded-xl p-6 space-y-4">
                    <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Deine Bestellung</h2>
                    <div class="flex items-start gap-4">
                        {#if course.thumbnailUrl}
                            <img src={course.thumbnailUrl} alt={course.title} class="w-20 h-14 object-cover rounded-lg flex-shrink-0" />
                        {/if}
                        <div class="flex-1 min-w-0">
                            <h3 class="font-semibold text-lg leading-snug">{course.title}</h3>
                            {#if course.subtitle}
                                <p class="text-sm text-muted-foreground mt-1 line-clamp-2">{course.subtitle}</p>
                            {/if}
                        </div>
                        <div class="text-right flex-shrink-0">
                            <span class="text-xl font-bold">€{formatPrice(course.price)}</span>
                        </div>
                    </div>
                </div>

                <!-- Order Bumps -->
                {#each upsells as upsell}
                    {@const discountedPrice = getUpsellPrice(upsell)}
                    <label class="block cursor-pointer" for="upsell-{upsell.id}">
                        <div class="bg-card border-2 rounded-xl p-5 transition-colors {selectedUpsells[upsell.id] ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/30 hover:border-muted-foreground/60'}">
                            <div class="flex items-start gap-4">
                                <div class="flex-shrink-0 mt-0.5">
                                    <div class="w-6 h-6 rounded border-2 flex items-center justify-center transition-colors {selectedUpsells[upsell.id] ? 'bg-primary border-primary' : 'border-muted-foreground/40'}">
                                        {#if selectedUpsells[upsell.id]}
                                            <CheckCircle2 class="w-4 h-4 text-primary-foreground" />
                                        {/if}
                                    </div>
                                </div>
                                <input type="checkbox" id="upsell-{upsell.id}" class="sr-only" bind:checked={selectedUpsells[upsell.id]} />
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <Badge variant="secondary" class="text-xs">
                                            <Plus class="w-3 h-3 mr-1" /> Add-on
                                        </Badge>
                                        {#if upsell.discountPercent > 0}
                                            <Badge class="text-xs bg-green-500/10 text-green-700 border-green-200">
                                                {upsell.discountPercent}% off
                                            </Badge>
                                        {/if}
                                    </div>
                                    <h3 class="font-semibold">{upsell.label || upsell.upsellCourse.title}</h3>
                                    {#if upsell.upsellCourse.subtitle}
                                        <p class="text-sm text-muted-foreground mt-1">{upsell.upsellCourse.subtitle}</p>
                                    {/if}
                                </div>
                                <div class="text-right flex-shrink-0">
                                    {#if upsell.discountPercent > 0}
                                        <div class="text-xs text-muted-foreground line-through">€{formatPrice(upsell.upsellCourse.price)}</div>
                                    {/if}
                                    <div class="text-lg font-bold {upsell.discountPercent > 0 ? 'text-green-700' : ''}">
                                        €{formatPrice(discountedPrice)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </label>
                {/each}

                <!-- Billing Info -->
                <div class="bg-card border rounded-xl p-6 space-y-4">
                    <h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Rechnungsadresse</h2>

                    <div class="grid gap-3">
                        <div class="grid gap-1.5">
                            <Label for="billingName">Vor- & Nachname</Label>
                            <Input id="billingName" bind:value={billingName} placeholder="Max Mustermann" required />
                        </div>

                        <div class="grid gap-1.5">
                            <Label for="billingEmail">E-Mail-Adresse</Label>
                            <Input id="billingEmail" type="email" bind:value={billingEmail} placeholder="max@example.com" required />
                        </div>

                        <div class="grid gap-1.5">
                            <Label for="billingStreet">Straße & Hausnummer</Label>
                            <Input id="billingStreet" bind:value={billingStreet} placeholder="Musterstraße 1" />
                        </div>

                        <div class="grid grid-cols-5 gap-3">
                            <div class="col-span-2 grid gap-1.5">
                                <Label for="billingZip">PLZ</Label>
                                <Input id="billingZip" bind:value={billingZip} placeholder="10115" />
                            </div>
                            <div class="col-span-3 grid gap-1.5">
                                <Label for="billingCity">Ort</Label>
                                <Input id="billingCity" bind:value={billingCity} placeholder="Berlin" />
                            </div>
                        </div>

                        <div class="grid gap-1.5">
                            <Label for="billingCountry">Land</Label>
                            <FormSelect id="billingCountry" bind:value={billingCountry}>
                                <option value="DE">Deutschland</option>
                                <option value="AT">Österreich</option>
                                <option value="CH">Schweiz</option>
                                <option value="LU">Luxemburg</option>
                                <option value="BE">Belgien</option>
                                <option value="NL">Niederlande</option>
                                <option value="FR">Frankreich</option>
                                <option value="IT">Italien</option>
                                <option value="ES">Spanien</option>
                                <option value="PL">Polen</option>
                                <option value="CZ">Tschechien</option>
                                <option value="SE">Schweden</option>
                                <option value="DK">Dänemark</option>
                                <option value="FI">Finnland</option>
                                <option value="GB">Vereinigtes Königreich</option>
                                <option value="US">USA</option>
                                <option value="OTHER">Sonstiges</option>
                            </FormSelect>
                        </div>
                    </div>

                    <!-- Reverse Charge B2B section -->
                    {#if reverseChargeEnabled}
                        <div class="border-t border-border/40 pt-4 space-y-3">
                            <label class="flex items-center gap-2.5 cursor-pointer">
                                <input type="checkbox" bind:checked={isBusiness} class="w-4 h-4 accent-primary" />
                                <span class="text-sm font-medium">Ich kaufe als Unternehmen (B2B)</span>
                            </label>

                            {#if isBusiness}
                                <div class="grid gap-1.5">
                                    <Label for="billingVatId">Umsatzsteuer-ID</Label>
                                    <Input id="billingVatId" bind:value={billingVatId} placeholder="DE123456789" class="font-mono" />
                                    <p class="text-xs text-muted-foreground">
                                        {#if reverseChargeApplies}
                                            <span class="text-green-600 font-medium">✓ Reverse Charge wird angewandt — 0 % MwSt., Netto-Betrag wird berechnet.</span>
                                        {:else}
                                            USt-IdNr. aus einem anderen EU-Land eingeben, um Reverse Charge anzuwenden.
                                        {/if}
                                    </p>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Right: Payment -->
            <div class="lg:col-span-2">
                <div class="bg-card border rounded-xl p-6 space-y-5 sticky top-8">
                    <!-- Order total with tax breakdown -->
                    <div class="space-y-2 text-sm border-b pb-4">
                        <h2 class="font-semibold text-base">Zusammenfassung</h2>
                        <div class="flex justify-between">
                            <span class="text-muted-foreground truncate pr-2">{course.title}</span>
                            <span class="font-medium flex-shrink-0">€{formatPrice(course.price)}</span>
                        </div>
                        {#each upsells as upsell}
                            {#if selectedUpsells[upsell.id]}
                                <div class="flex justify-between text-primary">
                                    <span class="truncate pr-2">{upsell.upsellCourse.title}</span>
                                    <span class="font-medium flex-shrink-0">€{formatPrice(getUpsellPrice(upsell))}</span>
                                </div>
                            {/if}
                        {/each}

                        <!-- Discount line -->
                        {#if appliedCoupon && discountAmount > 0}
                            <div class="flex justify-between text-green-600">
                                <span class="truncate pr-2">Rabatt ({appliedCoupon.code})</span>
                                <span class="font-medium flex-shrink-0">-€{formatPrice(discountAmount)}</span>
                            </div>
                        {/if}

                        <!-- Tax breakdown -->
                        {#if vatRate > 0 || reverseChargeApplies || isNonEU}
                            <div class="border-t border-border/30 pt-2 mt-2 space-y-1 text-xs text-muted-foreground">
                                <div class="flex justify-between">
                                    <span>Nettobetrag</span>
                                    <span>€{formatPrice(netTotal)}</span>
                                </div>
                                {#if isNonEU}
                                    <div class="flex justify-between text-green-600">
                                        <span>Steuerfreie Lieferung (Drittland)</span>
                                        <span>€0,00</span>
                                    </div>
                                {:else if reverseChargeApplies}
                                    <div class="flex justify-between text-green-600">
                                        <span>MwSt. (Reverse Charge §13b)</span>
                                        <span>€0,00</span>
                                    </div>
                                    <p class="text-[10px] text-muted-foreground/70 leading-snug">Gem. § 13b UStG schuldet der Leistungsempfänger die Steuer.</p>
                                {:else}
                                    <div class="flex justify-between">
                                        <span>MwSt. {vatRate}%</span>
                                        <span>€{formatPrice(vatAmount)}</span>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <div class="flex justify-between font-bold text-base pt-1 border-t mt-2">
                            <span>Gesamt</span>
                            <span>€{formatPrice(chargeTotal)}</span>
                        </div>
                    </div>

                    <!-- Payment method selector -->
                    {#if availableMethods.length > 1}
                        <div class="space-y-2">
                            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zahlungsmethode</p>
                            <div class="grid grid-cols-2 gap-2">
                                {#each availableMethods as method}
                                    <button
                                        onclick={() => selectedMethod = method.id}
                                        class="flex flex-col items-start gap-0.5 p-2.5 rounded-lg border text-left transition-all {selectedMethod === method.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground'}"
                                    >
                                        <span class="font-medium text-xs leading-tight {selectedMethod === method.id ? 'text-primary' : ''}">{method.label}</span>
                                        <span class="text-[10px] text-muted-foreground leading-tight">{method.sub}</span>
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Stripe -->
                    {#if isStripeMethod}
                        <div class="space-y-2">
                            <Label class="flex items-center gap-1.5 text-sm">
                                <Tag class="w-3.5 h-3.5" /> Gutscheincode
                            </Label>
                            {#if appliedCoupon}
                                <div class="flex items-center justify-between bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                                    <div class="flex items-center gap-2">
                                        <CheckCircle2 class="w-4 h-4 text-green-600 flex-shrink-0" />
                                        <span class="text-sm font-medium text-green-700 dark:text-green-400">{appliedCoupon.code}</span>
                                        <span class="text-xs text-green-600">
                                            {appliedCoupon.discountType === 'percentage' ? `-${appliedCoupon.discountValue}%` : `-€${formatPrice(appliedCoupon.discountValue)}`}
                                        </span>
                                    </div>
                                    <button onclick={() => { appliedCoupon = null; couponCode = ''; }} class="text-muted-foreground hover:text-foreground ml-2">
                                        <X class="w-4 h-4" />
                                    </button>
                                </div>
                            {:else}
                                <div class="flex gap-2">
                                    <Input
                                        bind:value={couponCode}
                                        placeholder="SAVE20"
                                        class="uppercase"
                                        oninput={(e) => { couponCode = (e.target as HTMLInputElement).value.toUpperCase(); couponError = ''; }}
                                        onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                                    />
                                    <Button variant="outline" onclick={applyCoupon} disabled={couponLoading || !couponCode.trim()}>
                                        {couponLoading ? '…' : 'Anwenden'}
                                    </Button>
                                </div>
                                {#if couponError}
                                    <p class="text-xs text-destructive">{couponError}</p>
                                {/if}
                            {/if}
                        </div>

                        <Button
                            class="w-full"
                            size="lg"
                            onclick={handleCheckout}
                            disabled={isLoading}
                        >
                            {#if isLoading}
                                Wird verarbeitet...
                            {:else}
                                <ShoppingCart class="w-4 h-4 mr-2" />
                                Bezahlen · €{formatPrice(chargeTotal)}
                                <ArrowRight class="w-4 h-4 ml-2" />
                            {/if}
                        </Button>

                        <div class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                            <Lock class="w-3 h-3" />
                            Gesichert durch Stripe
                        </div>

                    <!-- PayPal -->
                    {:else if selectedMethod === 'paypal'}
                        {#if couponError}
                            <p class="text-xs text-destructive">{couponError}</p>
                        {/if}
                        <div bind:this={paypalContainer} class="min-h-[50px]">
                            {#if !paypalLoaded}
                                <div class="flex items-center justify-center h-12 text-sm text-muted-foreground">
                                    PayPal wird geladen...
                                </div>
                            {/if}
                        </div>
                        <div class="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                            <Lock class="w-3 h-3" /> Gesichert durch PayPal
                        </div>
                    {/if}

                    {#if !user}
                        <p class="text-xs text-center text-muted-foreground">
                            Du kannst als Gast fortfahren oder dich zuerst <a href="/login?redirect=/checkout/{course.slug}" class="text-primary underline">anmelden</a>.
                        </p>
                    {/if}

                    {#if vatRate > 0 && !reverseChargeApplies}
                        <p class="text-[10px] text-muted-foreground text-center">
                            Alle Preise inkl. {vatRate}&nbsp;% MwSt.
                        </p>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
