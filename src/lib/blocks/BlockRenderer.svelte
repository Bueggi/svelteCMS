<script lang="ts">
  import { onMount } from 'svelte';
  import type { Block, BlockStyle } from './types';
  import { Star, ShieldCheck, Check, Users, Clock, ShoppingCart, ArrowRight, Tag, Lock, Plus, CheckCircle2 } from 'lucide-svelte';

  let { block, courseSlug, coursePrice, courseTitle, courseThumbnailUrl, courseId, courseUpsells, checkoutMode, enabledMethods, paypalClientId, vatRate = 0, reverseChargeEnabled = false, operatorCountry = 'DE', taxRates = [], funnelSlug, funnelCheckoutPageId, purchaseAmount, sandboxMode = false }: {
    block: Block;
    courseSlug?: string;
    coursePrice?: number;
    courseTitle?: string;
    courseThumbnailUrl?: string;
    courseId?: string;
    courseUpsells?: any[];
    checkoutMode?: string;
    enabledMethods?: string[];
    paypalClientId?: string | null;
    vatRate?: number;
    reverseChargeEnabled?: boolean;
    operatorCountry?: string;
    taxRates?: any[];
    funnelSlug?: string;
    funnelCheckoutPageId?: string;
    purchaseAmount?: number;
    sandboxMode?: boolean;
  } = $props();

  // Checkout block state (used when block.type === 'checkout')
  let selectedUpsells = $state<Record<string, boolean>>({});
  let couponCode = $state('');
  let couponLoading = $state(false);
  let couponError = $state('');
  let appliedCoupon = $state<{ code: string; discountType: 'percentage' | 'amount'; discountValue: number } | null>(null);
  let isCheckoutLoading = $state(false);

  // Billing state
  let billingName = $state('');
  let billingEmail = $state('');
  let billingStreet = $state('');
  let billingZip = $state('');
  let billingCity = $state('');
  let billingCountry = $state('DE');
  let isBusiness = $state(false);
  let billingVatId = $state('');

  const EU_COUNTRIES = ['AT','BE','BG','CY','CZ','DK','EE','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];

  const reverseChargeApplies = $derived(
    reverseChargeEnabled && isBusiness &&
    billingVatId.trim().length >= 4 &&
    EU_COUNTRIES.includes(billingVatId.trim().slice(0, 2).toUpperCase()) &&
    billingVatId.trim().slice(0, 2).toUpperCase() !== operatorCountry.toUpperCase()
  );

  // Non-EU buyer: no EU VAT applies (different from RC — place of supply is outside EU)
  const isNonEU = $derived(
    reverseChargeEnabled &&
    !EU_COUNTRIES.includes(billingCountry) &&
    billingCountry !== operatorCountry.toUpperCase()
  );

  // Payment method state for embedded checkout block
  const BLOCK_STRIPE_METHODS = ['card', 'sepa_debit', 'klarna', 'link', 'sofort'];
  const BLOCK_METHOD_META: Record<string, { label: string; sub: string }> = {
    card:       { label: 'Kreditkarte',      sub: 'inkl. Apple Pay & Google Pay' },
    sepa_debit: { label: 'SEPA-Lastschrift', sub: 'Bankeinzug (DE/AT/CH)' },
    klarna:     { label: 'Klarna',           sub: 'Ratenkauf / Kauf auf Rechnung' },
    link:       { label: 'Link',             sub: '1-Click Checkout via Stripe' },
    sofort:     { label: 'SOFORT',           sub: 'Sofortüberweisung' },
    paypal:     { label: 'PayPal',           sub: 'PayPal-Konto oder Kreditkarte' },
  };

  const availableBlockMethods = $derived(
    (enabledMethods ?? ['card'])
      .filter(m => BLOCK_STRIPE_METHODS.includes(m) || (m === 'paypal' && !!paypalClientId))
      .map(m => ({ id: m, ...(BLOCK_METHOD_META[m as keyof typeof BLOCK_METHOD_META] ?? { label: m, sub: '' }) }))
  );

  let selectedPaymentMethod = $state<string>('card');

  const isStripePayment = $derived(BLOCK_STRIPE_METHODS.includes(selectedPaymentMethod));

  let paypalLoaded = $state(false);
  let paypalContainer = $state<HTMLElement | null>(null);

  const hasPayPal = $derived(
    (enabledMethods ?? []).includes('paypal') && !!paypalClientId
  );

  // Brand SVG icons for payment methods
  function getMethodIcon(id: string): string {
    const icons: Record<string, string> = {
      card: `<svg viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="28" rx="5" fill="#1A1F71"/>
        <rect y="7" width="44" height="7" fill="#0F1357"/>
        <rect x="4" y="18" width="13" height="5" rx="2" fill="#F6C343" opacity="0.9"/>
        <circle cx="32" cy="20" r="4.5" fill="#EB001B" opacity="0.9"/>
        <circle cx="38" cy="20" r="4.5" fill="#F79E1B" opacity="0.9"/>
        <circle cx="35" cy="20" r="4.5" fill="#FF5F00" opacity="0.5"/>
      </svg>`,
      sepa_debit: `<svg viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="28" rx="5" fill="#003399"/>
        <text x="22" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="white">€</text>
        <circle cx="8" cy="6" r="2" fill="#FFCC00" opacity="0.8"/>
        <circle cx="36" cy="6" r="2" fill="#FFCC00" opacity="0.8"/>
      </svg>`,
      klarna: `<svg viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="28" rx="5" fill="#FFB3C7"/>
        <text x="22" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#17120E">K</text>
        <circle cx="36" cy="14" r="4" fill="#FF8FAB"/>
      </svg>`,
      link: `<svg viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="28" rx="5" fill="#635BFF"/>
        <text x="22" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="white">LINK</text>
      </svg>`,
      sofort: `<svg viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="28" rx="5" fill="#EE3124"/>
        <text x="22" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="white">SOFORT</text>
        <text x="22" y="25" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" fill="white" opacity="0.8">banking</text>
      </svg>`,
      paypal: `<svg viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg">
        <rect width="44" height="28" rx="5" fill="#003087"/>
        <text x="9" y="20" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#009CDE">Pay</text>
        <text x="25" y="20" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#012169">Pal</text>
      </svg>`,
    };
    return icons[id] ?? `<svg viewBox="0 0 44 28" xmlns="http://www.w3.org/2000/svg"><rect width="44" height="28" rx="5" fill="#6B7280"/></svg>`;
  }

  onMount(() => {
    if (block.type === 'custom_css') {
      const b = block as any;
      if (b.css) {
        const style = document.createElement('style');
        style.setAttribute('data-block-id', b.id);
        style.textContent = b.css;
        document.head.appendChild(style);
        return () => { style.remove(); };
      }
      return;
    }
    if (block.type === 'checkout' && hasPayPal && paypalClientId) {
      if (!(window as any).paypal) {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=EUR&components=buttons`;
        script.onload = () => { paypalLoaded = true; };
        document.head.appendChild(script);
      } else {
        paypalLoaded = true;
      }
    }
  });

  $effect(() => {
    if (paypalLoaded && selectedPaymentMethod === 'paypal' && paypalContainer && (window as any).paypal) {
      paypalContainer.innerHTML = '';
      (window as any).paypal.Buttons({
        createOrder: async () => {
          const selectedIds = Object.entries(selectedUpsells).filter(([, v]) => v).map(([id]) => id);
          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, upsellIds: selectedIds }),
          });
          return (await res.json()).id;
        },
        onApprove: async (approveData: any) => {
          isCheckoutLoading = true;
          const selectedIds = Object.entries(selectedUpsells).filter(([, v]) => v).map(([id]) => id);
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: approveData.orderID, courseId, upsellIds: selectedIds }),
          });
          const result = await res.json();
          if (result.success) window.location.href = funnelSlug ? `/f/${funnelSlug}/thank-you` : `/thank-you?course=${result.courseSlug}`;
          else { couponError = 'PayPal-Zahlung fehlgeschlagen.'; isCheckoutLoading = false; }
        },
        onError: () => { couponError = 'PayPal-Fehler. Bitte erneut versuchen.'; },
      }).render(paypalContainer);
    }
  });

  function resolveCtaHref(slug?: string): string {
    if (checkoutMode === 'embedded') return '#checkout-block';
    if (funnelSlug) return funnelCheckoutPageId ? `/f/${funnelSlug}/c/${funnelCheckoutPageId}` : '#';
    return slug ? `/checkout/${slug}` : '#';
  }

  function handleCtaClick(e: MouseEvent) {
    if (checkoutMode === 'embedded') {
      e.preventDefault();
      document.getElementById('checkout-block')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function getUpsellPrice(upsell: any) {
    const base = upsell.upsellCourse.price;
    return upsell.discountPercent > 0 ? Math.round(base * (1 - upsell.discountPercent / 100)) : base;
  }

  // Effective VAT rate:
  //   RC disabled → always global vatRate
  //   RC enabled + non-EU buyer → 0% (no EU tax jurisdiction)
  //   RC enabled + EU B2B different country → 0% (Reverse Charge §13b)
  //   RC enabled + everything else → per-country table rate or global fallback
  const effectiveVatRate = $derived.by(() => {
    if (!reverseChargeEnabled) return vatRate;
    if (isNonEU || reverseChargeApplies) return 0;
    return taxRates.find((r: any) => r.countryCode === billingCountry && r.isEnabled)?.rate ?? vatRate;
  });

  const grossTotal = $derived(
    (courseUpsells ?? []).reduce(
      (total, upsell) => total + (selectedUpsells[upsell.id] ? getUpsellPrice(upsell) : 0),
      coursePrice ?? 0
    )
  );

  const discountAmount = $derived(
    !appliedCoupon ? 0
    : appliedCoupon.discountType === 'percentage'
      ? Math.round(grossTotal * appliedCoupon.discountValue / 100)
      : Math.min(grossTotal, appliedCoupon.discountValue)
  );

  const discountedGross = $derived(Math.max(0, grossTotal - discountAmount));

  const netTotal = $derived(
    effectiveVatRate > 0 ? Math.round(discountedGross / (1 + effectiveVatRate / 100)) : discountedGross
  );

  const vatAmount = $derived(discountedGross - netTotal);

  const chargeTotal = $derived(reverseChargeApplies ? netTotal : discountedGross);

  // Keep orderTotal as alias for use in templates
  const orderTotal = $derived(chargeTotal);

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    couponLoading = true;
    couponError = '';
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, courseId }),
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
    isCheckoutLoading = true;
    couponError = '';
    const selectedUpsellIds = Object.entries(selectedUpsells).filter(([, v]) => v).map(([id]) => id);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(funnelSlug ? {
          courseId,
          funnelSlug,
          bumpCourseIds: (courseUpsells ?? []).filter((u: any) => selectedUpsellIds.includes(u.id)).map((u: any) => u.upsellCourse.id),
          couponCode: couponCode.trim() || undefined,
          selectedMethod: isStripePayment ? selectedPaymentMethod : undefined,
          reverseCharge: reverseChargeApplies,
          sandboxMode,
          billingAddress: {
            name: billingName.trim(),
            email: billingEmail.trim(),
            street: billingStreet.trim(),
            zip: billingZip.trim(),
            city: billingCity.trim(),
            country: billingCountry,
            vatId: (isBusiness && billingVatId.trim()) ? billingVatId.trim() : undefined,
          },
        } : {
          courseId,
          upsellIds: selectedUpsellIds,
          couponCode: couponCode.trim() || undefined,
          selectedMethod: isStripePayment ? selectedPaymentMethod : undefined,
          reverseCharge: reverseChargeApplies,
          sandboxMode,
          billingAddress: {
            name: billingName.trim(),
            email: billingEmail.trim(),
            street: billingStreet.trim(),
            zip: billingZip.trim(),
            city: billingCity.trim(),
            country: billingCountry,
            vatId: (isBusiness && billingVatId.trim()) ? billingVatId.trim() : undefined,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) { couponError = result.message || 'Checkout fehlgeschlagen.'; isCheckoutLoading = false; return; }
      if (result.url) window.location.href = result.url;
    } catch {
      couponError = 'Ein Fehler ist aufgetreten.';
      isCheckoutLoading = false;
    }
  }

  function toEmbedUrl(url: string): string {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/);
    if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return url;
  }

  function formatPrice(cents: number) {
    return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  }

  const WEIGHT_MAP: Record<string, string> = { light: '300', normal: '400', medium: '500', semibold: '600', bold: '700' };

  const fontHref = $derived.by(() => {
    const fonts = [block.blockStyle?.headlineFont, block.blockStyle?.bodyFont].filter((f): f is string => !!f);
    if (!fonts.length) return '';
    return `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&')}&display=swap`;
  });

  function getBlockStyle(style?: BlockStyle): string {
    if (!style) return '';
    const parts: string[] = [];
    if (style.bgType === 'color' && style.bgColor) {
      parts.push(`background-color: ${style.bgColor}`);
    } else if (style.bgType === 'gradient' && style.bgGradientFrom && style.bgGradientTo) {
      const dirMap: Record<string, string> = {
        'to-right': 'to right', 'to-bottom': 'to bottom',
        'to-bottom-right': 'to bottom right', 'to-bottom-left': 'to bottom left',
      };
      const dir = dirMap[style.bgGradientDir ?? 'to-bottom'] ?? 'to bottom';
      parts.push(`background: linear-gradient(${dir}, ${style.bgGradientFrom}, ${style.bgGradientTo})`);
    } else if (style.bgType === 'image' && style.bgImage) {
      parts.push(`background-image: url('${style.bgImage}')`);
      parts.push(`background-size: cover`);
      parts.push(`background-position: center`);
    }
    if (style.textColor) parts.push(`color: ${style.textColor}`);
    const padMap: Record<string, string> = {
      sm: '2rem 1.5rem', md: '4rem 1.5rem', lg: '6rem 1.5rem', xl: '8rem 1.5rem',
    };
    if (style.padding && padMap[style.padding]) parts.push(`padding: ${padMap[style.padding]}`);
    if (style.bodyFontWeight && WEIGHT_MAP[style.bodyFontWeight]) {
      parts.push(`font-weight: ${WEIGHT_MAP[style.bodyFontWeight]}`);
    }
    if (style.bodyFont) parts.push(`font-family: '${style.bodyFont}', sans-serif`);
    return parts.join('; ');
  }

  // Returns inline style for headline elements (h1/h2/h3)
  function hlStyle(style?: BlockStyle): string {
    const parts: string[] = [];
    if (style?.headlineColor) parts.push(`color: ${style.headlineColor}`);
    if (style?.headlineFontWeight && WEIGHT_MAP[style.headlineFontWeight]) {
      parts.push(`font-weight: ${WEIGHT_MAP[style.headlineFontWeight]}`);
    }
    if (style?.headlineFont) parts.push(`font-family: '${style.headlineFont}', serif`);
    return parts.join('; ');
  }

  // Returns inline style for subheadline/body paragraph elements
  function subStyle(style?: BlockStyle): string {
    const parts: string[] = [];
    if (style?.textColor) parts.push(`color: ${style.textColor}`);
    if (style?.bodyFont) parts.push(`font-family: '${style.bodyFont}', sans-serif`);
    if (style?.bodyFontWeight && WEIGHT_MAP[style.bodyFontWeight]) {
      parts.push(`font-weight: ${WEIGHT_MAP[style.bodyFontWeight]}`);
    }
    return parts.join('; ');
  }

  // Returns inline style for CTA button/anchor elements
  function btnStyle(style?: BlockStyle): string {
    const parts: string[] = [];
    if (style?.buttonBgColor) parts.push(`background-color: ${style.buttonBgColor}`);
    if (style?.buttonTextColor) parts.push(`color: ${style.buttonTextColor}`);
    return parts.join('; ');
  }

  function hasOverlay(style?: BlockStyle): boolean {
    return style?.bgType === 'image' && (style.bgImageOverlay ?? 0) > 0;
  }
</script>

<svelte:head>
  {#if fontHref}
    <link rel="stylesheet" href={fontHref} />
  {/if}
</svelte:head>

{#if block.type === 'hero'}
  {@const b = block}
  {@const v = b.variant ?? b.layout ?? 'centered'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}

  {#if v === 'fullscreen'}
    <section class="relative min-h-screen flex items-center px-6 {b.blockStyle?.padding ? '' : 'py-24'} text-center" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 w-full max-w-4xl mx-auto">
        <h1 class="text-5xl md:text-7xl font-serif leading-tight tracking-tight" style={hlStyle(b.blockStyle)}>{b.headline}</h1>
        {#if b.subheadline}<p class="mt-6 text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto opacity-90" style={subStyle(b.blockStyle)}>{b.subheadline}</p>{/if}
        {#if b.ctaText && courseSlug}
          <div class="mt-10">
            <a href={resolveCtaHref(courseSlug)} onclick={handleCtaClick} style={btnStyle(b.blockStyle)} class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:-translate-y-0.5">
              {b.ctaText}
              {#if coursePrice}<span class="opacity-80 text-base font-normal ml-2">{formatPrice(coursePrice)}</span>{/if}
            </a>
          </div>
        {/if}
      </div>
    </section>

  {:else if v === 'minimal'}
    <section class="relative px-6 {b.blockStyle?.padding ? '' : 'py-12 md:py-16'}" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 max-w-3xl">
        <h1 class="text-4xl md:text-5xl font-serif leading-tight tracking-tight text-foreground" style={hlStyle(b.blockStyle)}>{b.headline}</h1>
        {#if b.subheadline}<p class="mt-4 text-lg text-muted-foreground leading-relaxed" style={subStyle(b.blockStyle)}>{b.subheadline}</p>{/if}
      </div>
    </section>

  {:else}
    <section class="relative py-24 md:py-36 px-6 overflow-hidden {v === 'left' ? 'text-left' : v === 'split' ? '' : 'text-center'}" style={sty}>
      {#if b.imageUrl && v !== 'split'}
        <div class="absolute inset-0 -z-10">
          <img src={b.imageUrl} alt="" class="w-full h-full object-cover opacity-15" />
          <div class="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background"></div>
        </div>
      {/if}
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 max-w-5xl mx-auto {v === 'split' ? 'grid grid-cols-1 md:grid-cols-2 gap-12 items-center' : ''}">
        <div>
          <h1 class="text-5xl md:text-7xl font-serif leading-tight tracking-tight text-foreground" style={hlStyle(b.blockStyle)}>{b.headline}</h1>
          {#if b.subheadline}
            <p class="mt-6 text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl {v !== 'split' && v !== 'left' ? 'mx-auto' : ''}" style={subStyle(b.blockStyle)}>{b.subheadline}</p>
          {/if}
          {#if b.ctaText && courseSlug}
            <div class="mt-10">
              <a href={resolveCtaHref(courseSlug)} onclick={handleCtaClick} style={btnStyle(b.blockStyle)} class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:-translate-y-0.5">
                {b.ctaText}
                {#if coursePrice}<span class="opacity-80 text-base font-normal ml-2">{formatPrice(coursePrice)}</span>{/if}
              </a>
            </div>
          {/if}
        </div>
        {#if b.imageUrl && v === 'split'}
          <div class="rounded-2xl overflow-hidden shadow-2xl">
            <img src={b.imageUrl} alt="" class="w-full h-full object-cover" />
          </div>
        {/if}
      </div>
    </section>
  {/if}

{:else if block.type === 'features'}
  {@const b = block}
  {@const v = b.variant ?? b.layout ?? 'grid'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}
  <section class="relative py-16 md:py-24 px-6" style={sty}>
    {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
    <div class="relative z-10 max-w-5xl mx-auto">
      {#if b.title}<h2 class="text-3xl md:text-4xl font-serif text-center mb-12 text-foreground" style={hlStyle(b.blockStyle)}>{b.title}</h2>{/if}
      {#if v === 'grid'}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each b.items as item}
            <div class="p-6 bg-card/60 border border-border/50 rounded-2xl hover:border-primary/30 hover:shadow-md transition-all">
              {#if item.icon}<div class="text-3xl mb-4">{item.icon}</div>{/if}
              <h3 class="font-semibold text-lg text-foreground" style={hlStyle(b.blockStyle)}>{item.title}</h3>
              {#if item.description}<p class="text-sm text-muted-foreground mt-2 leading-relaxed">{item.description}</p>{/if}
            </div>
          {/each}
        </div>
      {:else if v === 'list'}
        <div class="space-y-4 max-w-2xl mx-auto">
          {#each b.items as item}
            <div class="flex items-start gap-4 p-5 bg-card/60 border border-border/50 rounded-2xl hover:border-primary/30 transition-all">
              {#if item.icon}<div class="text-2xl shrink-0">{item.icon}</div>{/if}
              <div>
                <h3 class="font-semibold text-lg text-foreground" style={hlStyle(b.blockStyle)}>{item.title}</h3>
                {#if item.description}<p class="text-sm text-muted-foreground mt-1 leading-relaxed">{item.description}</p>{/if}
              </div>
            </div>
          {/each}
        </div>
      {:else if v === 'checkmarks'}
        <div class="space-y-3 max-w-2xl mx-auto">
          {#each b.items as item}
            <div class="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
              <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Check class="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p class="font-medium text-foreground" style={hlStyle(b.blockStyle)}>{item.title}</p>
                {#if item.description}<p class="text-sm text-muted-foreground mt-0.5">{item.description}</p>{/if}
              </div>
            </div>
          {/each}
        </div>
      {:else if v === 'numbered'}
        <div class="space-y-4 max-w-2xl mx-auto">
          {#each b.items as item, i}
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-lg shrink-0 mt-0.5">{i + 1}</div>
              <div class="pt-1">
                <p class="font-semibold text-foreground text-lg" style={hlStyle(b.blockStyle)}>{item.title}</p>
                {#if item.description}<p class="text-sm text-muted-foreground mt-1 leading-relaxed">{item.description}</p>{/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </section>

{:else if block.type === 'testimonials'}
  {@const b = block}
  {@const v = b.variant ?? 'cards'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}
  <section class="relative py-16 md:py-24 px-6 {!b.blockStyle?.bgType || b.blockStyle.bgType === 'none' ? 'bg-muted/20' : ''}" style={sty}>
    {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
    <div class="relative z-10 max-w-5xl mx-auto">
      {#if b.title}<h2 class="text-3xl md:text-4xl font-serif text-center mb-12 text-foreground" style={hlStyle(b.blockStyle)}>{b.title}</h2>{/if}
      {#if v === 'cards'}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each b.items as item}
            <div class="bg-card border border-border/50 rounded-2xl p-6 space-y-4 hover:shadow-md transition-shadow">
              {#if item.rating}
                <div class="flex gap-0.5">{#each [1,2,3,4,5] as n}<Star class="w-4 h-4 {n <= item.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />{/each}</div>
              {/if}
              <p class="text-sm text-muted-foreground leading-relaxed italic">"{item.text}"</p>
              <div class="flex items-center gap-3 pt-2">
                {#if item.avatarUrl}
                  <img src={item.avatarUrl} alt={item.name} class="w-10 h-10 rounded-full object-cover" />
                {:else}
                  <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">{item.name.charAt(0)}</div>
                {/if}
                <div>
                  <p class="font-medium text-sm text-foreground">{item.name}</p>
                  {#if item.role}<p class="text-xs text-muted-foreground">{item.role}</p>{/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if v === 'minimal'}
        <div class="space-y-10 max-w-2xl mx-auto text-center">
          {#each b.items as item}
            <div class="space-y-4">
              {#if item.rating}
                <div class="flex justify-center gap-0.5">{#each [1,2,3,4,5] as n}<Star class="w-4 h-4 {n <= item.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />{/each}</div>
              {/if}
              <p class="text-xl text-foreground leading-relaxed italic">"{item.text}"</p>
              <div class="flex items-center justify-center gap-2">
                {#if item.avatarUrl}<img src={item.avatarUrl} alt={item.name} class="w-8 h-8 rounded-full object-cover" />{/if}
                <p class="text-sm font-medium text-foreground">{item.name}{item.role ? ` · ${item.role}` : ''}</p>
              </div>
            </div>
          {/each}
        </div>
      {:else if v === 'featured'}
        {@const [first, ...rest] = b.items}
        <div class="space-y-6">
          {#if first}
            <div class="bg-card border border-border/50 rounded-2xl p-8 space-y-4">
              {#if first.rating}
                <div class="flex gap-0.5">{#each [1,2,3,4,5] as n}<Star class="w-5 h-5 {n <= first.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />{/each}</div>
              {/if}
              <p class="text-lg md:text-xl text-muted-foreground leading-relaxed italic">"{first.text}"</p>
              <div class="flex items-center gap-3 pt-2">
                {#if first.avatarUrl}
                  <img src={first.avatarUrl} alt={first.name} class="w-12 h-12 rounded-full object-cover" />
                {:else}
                  <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">{first.name.charAt(0)}</div>
                {/if}
                <div>
                  <p class="font-semibold text-foreground">{first.name}</p>
                  {#if first.role}<p class="text-sm text-muted-foreground">{first.role}</p>{/if}
                </div>
              </div>
            </div>
          {/if}
          {#if rest.length}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {#each rest as item}
                <div class="bg-card border border-border/50 rounded-2xl p-6 space-y-3">
                  {#if item.rating}
                    <div class="flex gap-0.5">{#each [1,2,3,4,5] as n}<Star class="w-3.5 h-3.5 {n <= item.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />{/each}</div>
                  {/if}
                  <p class="text-sm text-muted-foreground leading-relaxed italic">"{item.text}"</p>
                  <p class="text-sm font-medium text-foreground">{item.name}{item.role ? ` · ${item.role}` : ''}</p>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </section>

{:else if block.type === 'faq'}
  {@const b = block}
  {@const v = b.variant ?? 'accordion'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}
  <section class="relative py-16 md:py-24 px-6" style={sty}>
    {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
    <div class="relative z-10 {v === 'two-col' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto">
      {#if b.title}<h2 class="text-3xl md:text-4xl font-serif text-center mb-12 text-foreground" style={hlStyle(b.blockStyle)}>{b.title}</h2>{/if}
      {#if v === 'accordion'}
        <div class="space-y-3">
          {#each b.items as item}
            <details class="group border border-border/50 rounded-xl bg-card overflow-hidden">
              <summary class="flex items-center justify-between px-6 py-4 cursor-pointer font-medium text-foreground hover:bg-muted/30 transition-colors list-none select-none">
                {item.question}
                <span class="text-muted-foreground group-open:rotate-45 transition-transform shrink-0 ml-4 text-xl leading-none">+</span>
              </summary>
              <div class="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-4">{item.answer}</div>
            </details>
          {/each}
        </div>
      {:else if v === 'two-col'}
        {@const half = Math.ceil(b.items.length / 2)}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
            {#each b.items.slice(0, half) as item}
              <details class="group border border-border/50 rounded-xl bg-card overflow-hidden">
                <summary class="flex items-center justify-between px-5 py-3.5 cursor-pointer font-medium text-foreground hover:bg-muted/30 transition-colors list-none select-none text-sm">
                  {item.question}
                  <span class="text-muted-foreground group-open:rotate-45 transition-transform shrink-0 ml-3 text-lg leading-none">+</span>
                </summary>
                <div class="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">{item.answer}</div>
              </details>
            {/each}
          </div>
          <div class="space-y-3">
            {#each b.items.slice(half) as item}
              <details class="group border border-border/50 rounded-xl bg-card overflow-hidden">
                <summary class="flex items-center justify-between px-5 py-3.5 cursor-pointer font-medium text-foreground hover:bg-muted/30 transition-colors list-none select-none text-sm">
                  {item.question}
                  <span class="text-muted-foreground group-open:rotate-45 transition-transform shrink-0 ml-3 text-lg leading-none">+</span>
                </summary>
                <div class="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">{item.answer}</div>
              </details>
            {/each}
          </div>
        </div>
      {:else if v === 'cards'}
        <div class="space-y-4">
          {#each b.items as item}
            <div class="bg-card border border-border/50 rounded-2xl p-6">
              <p class="font-semibold text-foreground mb-3" style={hlStyle(b.blockStyle)}>{item.question}</p>
              <p class="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </section>

{:else if block.type === 'richtext'}
  {@const b = block}
  {@const v = b.variant ?? 'default'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}
  <section class="relative py-12 px-6" style={sty}>
    {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
    <div class="relative z-10 {v === 'wide' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto prose prose-neutral dark:prose-invert prose-lg {v === 'centered' ? 'text-center' : ''}">
      {@html b.content}
    </div>
  </section>

{:else if block.type === 'cta'}
  {@const b = block}
  {@const v = b.variant ?? 'centered'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}

  {#if v === 'dark'}
    <section class="relative py-20 md:py-28 px-6 text-center bg-foreground text-background" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 max-w-2xl mx-auto space-y-6">
        {#if b.headline}<h2 class="text-4xl md:text-5xl font-serif font-semibold" style={hlStyle(b.blockStyle)}>{b.headline}</h2>{/if}
        {#if b.subtext}<p class="text-lg opacity-70">{b.subtext}</p>{/if}
        {#if b.buttonText && courseSlug}
          <a href={resolveCtaHref(courseSlug)} onclick={handleCtaClick} style={btnStyle(b.blockStyle)} class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:-translate-y-0.5">
            {b.buttonText}{#if coursePrice}<span class="opacity-80 text-base font-normal ml-2">{formatPrice(coursePrice)}</span>{/if}
          </a>
        {/if}
        {#if b.guaranteeText}<p class="text-sm opacity-60 flex items-center justify-center gap-1.5"><ShieldCheck class="w-4 h-4 text-green-400" />{b.guaranteeText}</p>{/if}
      </div>
    </section>

  {:else if v === 'bordered'}
    <section class="relative py-16 px-6" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 max-w-2xl mx-auto border-2 border-primary/20 rounded-2xl p-10 text-center space-y-6">
        {#if b.headline}<h2 class="text-3xl md:text-4xl font-serif font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.headline}</h2>{/if}
        {#if b.subtext}<p class="text-lg text-muted-foreground">{b.subtext}</p>{/if}
        {#if b.buttonText && courseSlug}
          <a href={resolveCtaHref(courseSlug)} onclick={handleCtaClick} style={btnStyle(b.blockStyle)} class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:-translate-y-0.5">
            {b.buttonText}{#if coursePrice}<span class="opacity-80 text-base font-normal ml-2">{formatPrice(coursePrice)}</span>{/if}
          </a>
        {/if}
        {#if b.guaranteeText}<p class="text-sm text-muted-foreground flex items-center justify-center gap-1.5"><ShieldCheck class="w-4 h-4 text-green-500" />{b.guaranteeText}</p>{/if}
      </div>
    </section>

  {:else if v === 'minimal'}
    <section class="relative py-10 px-6 text-center" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10">
        {#if b.buttonText && courseSlug}
          <a href={resolveCtaHref(courseSlug)} onclick={handleCtaClick} style={btnStyle(b.blockStyle)} class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:-translate-y-0.5">
            {b.buttonText}{#if coursePrice}<span class="opacity-80 text-base font-normal ml-2">{formatPrice(coursePrice)}</span>{/if}
          </a>
        {/if}
        {#if b.guaranteeText}<p class="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-3"><ShieldCheck class="w-4 h-4 text-green-500" />{b.guaranteeText}</p>{/if}
      </div>
    </section>

  {:else}
    <section class="relative py-20 md:py-28 px-6 text-center" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 max-w-2xl mx-auto space-y-6">
        {#if b.headline}<h2 class="text-4xl md:text-5xl font-serif font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.headline}</h2>{/if}
        {#if b.subtext}<p class="text-lg text-muted-foreground">{b.subtext}</p>{/if}
        {#if b.buttonText && courseSlug}
          <a href={resolveCtaHref(courseSlug)} onclick={handleCtaClick} style={btnStyle(b.blockStyle)} class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-8 py-4 rounded-xl text-lg font-semibold transition-all shadow-lg hover:-translate-y-0.5">
            {b.buttonText}{#if coursePrice}<span class="opacity-80 text-base font-normal ml-2">{formatPrice(coursePrice)}</span>{/if}
          </a>
        {/if}
        {#if b.guaranteeText}<p class="text-sm text-muted-foreground flex items-center justify-center gap-1.5"><ShieldCheck class="w-4 h-4 text-green-500" />{b.guaranteeText}</p>{/if}
      </div>
    </section>
  {/if}

{:else if block.type === 'instructor'}
  {@const b = block}
  {@const v = b.variant ?? 'horizontal'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}
  <section class="relative py-16 md:py-24 px-6" style={sty}>
    {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
    <div class="relative z-10 max-w-3xl mx-auto">
      {#if v === 'centered'}
        <div class="flex flex-col items-center text-center gap-6">
          {#if b.imageUrl}
            <img src={b.imageUrl} alt={b.name} class="w-32 h-32 rounded-full object-cover shadow-lg" />
          {:else}
            <div class="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-primary text-4xl font-serif">{b.name.charAt(0)}</div>
          {/if}
          <div class="space-y-3">
            <h3 class="text-2xl font-serif font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.name}</h3>
            <p class="text-muted-foreground leading-relaxed">{b.bio}</p>
            {#if b.credentials?.length}
              <ul class="space-y-1.5 text-left inline-block">
                {#each b.credentials as cred}
                  <li class="flex items-center gap-2 text-sm text-foreground"><Check class="w-4 h-4 text-primary shrink-0" />{cred}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      {:else if v === 'card'}
        <div class="bg-card border border-border/50 rounded-2xl p-8">
          <div class="flex flex-col sm:flex-row gap-6 items-start">
            {#if b.imageUrl}
              <img src={b.imageUrl} alt={b.name} class="w-24 h-24 rounded-2xl object-cover shadow-md shrink-0" />
            {:else}
              <div class="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-3xl font-serif shrink-0">{b.name.charAt(0)}</div>
            {/if}
            <div class="space-y-3">
              <h3 class="text-2xl font-serif font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.name}</h3>
              <p class="text-muted-foreground leading-relaxed">{b.bio}</p>
              {#if b.credentials?.length}
                <ul class="space-y-1.5">
                  {#each b.credentials as cred}
                    <li class="flex items-center gap-2 text-sm text-foreground"><Check class="w-4 h-4 text-primary shrink-0" />{cred}</li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        </div>
      {:else}
        <div class="flex flex-col sm:flex-row gap-8 items-start">
          {#if b.imageUrl}
            <img src={b.imageUrl} alt={b.name} class="w-32 h-32 rounded-2xl object-cover shadow-lg shrink-0" />
          {:else}
            <div class="w-32 h-32 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-4xl font-serif shrink-0">{b.name.charAt(0)}</div>
          {/if}
          <div class="space-y-4">
            <h3 class="text-2xl font-serif font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.name}</h3>
            <p class="text-muted-foreground leading-relaxed">{b.bio}</p>
            {#if b.credentials?.length}
              <ul class="space-y-1.5">
                {#each b.credentials as cred}
                  <li class="flex items-center gap-2 text-sm text-foreground"><Check class="w-4 h-4 text-primary shrink-0" />{cred}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </section>

{:else if block.type === 'video'}
  {@const b = block}
  {@const v = b.variant ?? 'default'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}
  <section class="relative py-16 px-6" style={sty}>
    {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
    <div class="relative z-10 {v === 'fullwidth' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto">
      {#if v === 'side-by-side'}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div class="aspect-video rounded-2xl overflow-hidden shadow-xl border border-border/30">
            <iframe src={toEmbedUrl(b.url)} class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title={b.title ?? 'Video'}></iframe>
          </div>
          <div class="space-y-3">
            {#if b.title}<h2 class="text-2xl font-serif font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.title}</h2>{/if}
            {#if b.description}<p class="text-muted-foreground leading-relaxed">{b.description}</p>{/if}
          </div>
        </div>
      {:else}
        {#if b.title}<h2 class="text-2xl font-serif font-semibold text-foreground text-center mb-4" style={hlStyle(b.blockStyle)}>{b.title}</h2>{/if}
        <div class="aspect-video rounded-2xl overflow-hidden shadow-xl border border-border/30">
          <iframe src={toEmbedUrl(b.url)} class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title={b.title ?? 'Video'}></iframe>
        </div>
        {#if b.description}<p class="text-sm text-muted-foreground text-center mt-4">{b.description}</p>{/if}
      {/if}
    </div>
  </section>

{:else if block.type === 'guarantee'}
  {@const b = block}
  {@const v = b.variant ?? 'badge'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {#if v === 'banner'}
    <div class="my-0 flex items-center gap-3 bg-green-50 dark:bg-green-900/15 border-y border-green-200 dark:border-green-800/30 px-6 py-4" style={sty}>
      <ShieldCheck class="w-6 h-6 text-green-600 shrink-0" />
      <div>
        <p class="font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.headline ?? `${b.days}-Tage Garantie`}</p>
        {#if b.text}<p class="text-sm text-muted-foreground">{b.text}</p>{/if}
      </div>
    </div>
  {:else if v === 'centered'}
    <div class="my-6 text-center py-10 px-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-2xl" style={sty}>
      <ShieldCheck class="w-12 h-12 text-green-600 mx-auto mb-4" />
      <p class="text-xl font-serif font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.headline ?? `${b.days}-Tage Garantie`}</p>
      {#if b.text}<p class="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{b.text}</p>{/if}
    </div>
  {:else}
    <div class="my-4 flex items-start gap-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-5" style={sty}>
      <ShieldCheck class="w-8 h-8 text-green-600 shrink-0 mt-0.5" />
      <div>
        <p class="font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.headline ?? `${b.days}-Tage Garantie`}</p>
        {#if b.text}<p class="text-sm text-muted-foreground mt-1">{b.text}</p>{/if}
      </div>
    </div>
  {/if}

{:else if block.type === 'bullets'}
  {@const b = block}
  {@const v = b.variant ?? 'checkmarks'}
  {@const sty = getBlockStyle(b.blockStyle)}
  <div class="my-4 space-y-3" style={sty}>
    {#if b.title}<p class="font-semibold text-foreground" style={hlStyle(b.blockStyle)}>{b.title}</p>{/if}
    {#if v === 'two-col'}
      <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {#each b.items as item}
          <li class="flex items-start gap-2 text-sm text-foreground"><Check class="w-4 h-4 text-primary mt-0.5 shrink-0" />{item}</li>
        {/each}
      </ul>
    {:else if v === 'numbered'}
      <ol class="space-y-2">
        {#each b.items as item, i}
          <li class="flex items-start gap-3 text-sm text-foreground">
            <span class="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>{item}
          </li>
        {/each}
      </ol>
    {:else if v === 'icons'}
      <ul class="space-y-2">
        {#each b.items as item}
          <li class="flex items-start gap-2.5 text-sm text-foreground"><span class="shrink-0 mt-0.5">✓</span>{item}</li>
        {/each}
      </ul>
    {:else}
      <ul class="space-y-2">
        {#each b.items as item}
          <li class="flex items-start gap-2 text-sm text-foreground"><Check class="w-4 h-4 text-primary mt-0.5 shrink-0" />{item}</li>
        {/each}
      </ul>
    {/if}
  </div>

{:else if block.type === 'social_proof'}
  {@const b = block}
  {@const v = b.variant ?? 'inline'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {#if v === 'centered'}
    <div class="my-6 py-8 text-center space-y-3" style={sty}>
      {#if b.rating}
        <div class="flex justify-center gap-1">{#each [1,2,3,4,5] as n}<Star class="w-5 h-5 {n <= Math.round(b.rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />{/each}</div>
        <p class="text-2xl font-bold text-foreground">{b.rating}</p>
        {#if b.reviewCount}<p class="text-sm text-muted-foreground">aus {b.reviewCount} Bewertungen</p>{/if}
      {/if}
      {#if b.count}<p class="text-muted-foreground"><strong class="text-foreground text-xl">{b.count.toLocaleString('de-DE')}</strong> {b.text ?? 'Teilnehmer'}</p>{/if}
    </div>
  {:else if v === 'cards'}
    <div class="my-6 grid grid-cols-1 sm:grid-cols-3 gap-4" style={sty}>
      {#if b.count}
        <div class="bg-card border border-border/50 rounded-xl p-5 text-center">
          <p class="text-2xl font-bold text-foreground">{b.count.toLocaleString('de-DE')}+</p>
          <p class="text-xs text-muted-foreground mt-1">{b.text ?? 'Teilnehmer'}</p>
        </div>
      {/if}
      {#if b.rating}
        <div class="bg-card border border-border/50 rounded-xl p-5 text-center">
          <p class="text-2xl font-bold text-foreground">{b.rating}</p>
          <div class="flex justify-center gap-0.5 mt-1">{#each [1,2,3,4,5] as n}<Star class="w-3.5 h-3.5 {n <= Math.round(b.rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />{/each}</div>
        </div>
      {/if}
      {#if b.reviewCount}
        <div class="bg-card border border-border/50 rounded-xl p-5 text-center">
          <p class="text-2xl font-bold text-foreground">{b.reviewCount}</p>
          <p class="text-xs text-muted-foreground mt-1">Bewertungen</p>
        </div>
      {/if}
    </div>
  {:else}
    <div class="my-4 flex items-center gap-4 flex-wrap text-sm text-muted-foreground" style={sty}>
      {#if b.count}
        <span class="flex items-center gap-1.5"><Users class="w-4 h-4" /><strong class="text-foreground">{b.count.toLocaleString('de-DE')}</strong> {b.text ?? 'Teilnehmer'}</span>
      {/if}
      {#if b.rating}
        <span class="flex items-center gap-1">
          {#each [1,2,3,4,5] as n}<Star class="w-3.5 h-3.5 {n <= Math.round(b.rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}" />{/each}
          <strong class="text-foreground ml-1">{b.rating}</strong>
          {#if b.reviewCount}<span class="text-muted-foreground">({b.reviewCount} Bewertungen)</span>{/if}
        </span>
      {/if}
    </div>
  {/if}

{:else if block.type === 'urgency'}
  {@const b = block}
  {@const v = b.variant ?? b.style ?? 'banner'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {#if v === 'badge'}
    <div class="my-4 inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 text-amber-700 dark:text-amber-400 rounded-full px-4 py-2 text-sm font-medium" style={sty}>
      <Clock class="w-4 h-4" />{b.text}
      {#if b.subtext}<span class="opacity-70 text-xs">· {b.subtext}</span>{/if}
    </div>
  {:else if v === 'card'}
    <div class="my-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 rounded-xl p-5 text-center" style={sty}>
      <Clock class="w-8 h-8 text-amber-500 mx-auto mb-2" />
      <p class="font-semibold text-amber-700 dark:text-amber-400">{b.text}</p>
      {#if b.subtext}<p class="text-sm text-amber-600/70 dark:text-amber-500/70 mt-1">{b.subtext}</p>{/if}
    </div>
  {:else}
    <div class="my-0 flex items-center gap-3 bg-amber-500 text-white px-6 py-3 text-sm font-semibold" style={sty}>
      <Clock class="w-4 h-4 shrink-0" /><span>{b.text}</span>
      {#if b.subtext}<span class="opacity-80 font-normal">– {b.subtext}</span>{/if}
    </div>
  {/if}

{:else if block.type === 'image_text'}
  {@const b = block}
  {@const v = b.variant ?? 'image-left'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}
  {@const ctaLinkHref = b.ctaUrl ? b.ctaUrl : (courseSlug ? resolveCtaHref(courseSlug) : undefined)}

  {#snippet imgEl(cls: string)}
    {#if b.imageUrl}
      <img src={b.imageUrl} alt={b.imageAlt ?? ''} class={cls} />
    {:else}
      <div class="{cls} bg-muted-foreground/10 flex items-center justify-center text-muted-foreground/30 text-sm">Kein Bild</div>
    {/if}
  {/snippet}

  {#snippet contentEl(extraClass: string)}
    <div class="space-y-4 {extraClass}">
      {#if b.headline}<h2 class="text-3xl md:text-4xl font-serif font-semibold text-foreground leading-tight" style={hlStyle(b.blockStyle)}>{b.headline}</h2>{/if}
      {#if b.subheadline}<p class="text-lg text-muted-foreground">{b.subheadline}</p>{/if}
      {#if b.body}
        <div class="prose prose-neutral dark:prose-invert prose-sm leading-relaxed">{@html b.body}</div>
      {/if}
      {#if b.ctaText && ctaLinkHref}
        <a href={ctaLinkHref} onclick={b.ctaUrl ? null : handleCtaClick} style={btnStyle(b.blockStyle)} class="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 px-6 py-3 rounded-xl font-semibold transition-all hover:-translate-y-0.5 shadow-md">
          {b.ctaText}
          {#if coursePrice && !b.ctaUrl}<span class="opacity-80 text-sm font-normal ml-1">{formatPrice(coursePrice)}</span>{/if}
        </a>
      {/if}
    </div>
  {/snippet}

  {#if v === 'image-cover-left' || v === 'image-cover-right'}
    <section class="relative overflow-hidden min-h-[480px] md:min-h-[560px]" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <!-- Cover image half -->
      <div class="absolute inset-y-0 {v === 'image-cover-left' ? 'left-0' : 'right-0'} w-full md:w-1/2 overflow-hidden">
        {#if b.imageUrl}
          <img src={b.imageUrl} alt={b.imageAlt ?? ''} class="w-full h-full object-cover" />
        {:else}
          <div class="w-full h-full bg-muted-foreground/10"></div>
        {/if}
      </div>
      <!-- Content half -->
      <div class="relative z-10 {v === 'image-cover-left' ? 'md:ml-[50%]' : 'md:mr-[50%]'} px-8 md:px-12 py-16 flex flex-col justify-center min-h-[480px] md:min-h-[560px]">
        {@render contentEl('')}
      </div>
    </section>

  {:else if v === 'image-top'}
    <section class="relative py-0 overflow-hidden" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10">
        <div class="w-full aspect-[16/7] overflow-hidden">
          {@render imgEl('w-full h-full object-cover')}
        </div>
        <div class="max-w-3xl mx-auto px-6 py-12">
          {@render contentEl('text-center items-center flex flex-col')}
        </div>
      </div>
    </section>

  {:else if v === 'image-sticky'}
    <section class="relative py-16 px-6" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        <div class="md:sticky md:top-20">
          {@render imgEl('w-full rounded-2xl shadow-xl object-cover')}
        </div>
        {@render contentEl('justify-center flex flex-col')}
      </div>
    </section>

  {:else}
    {@const isLargeLeft = v === 'image-large-left'}
    {@const isLargeRight = v === 'image-large-right'}
    {@const imgLeft = v === 'image-left' || isLargeLeft}
    <section class="relative py-16 md:py-24 px-6" style={sty}>
      {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
      <div class="relative z-10 max-w-5xl mx-auto grid grid-cols-1 {isLargeLeft || isLargeRight ? 'md:grid-cols-5' : 'md:grid-cols-2'} gap-10 md:gap-16 items-center">
        {#if imgLeft}
          <div class="{isLargeLeft ? 'md:col-span-3' : ''}">
            {@render imgEl('w-full rounded-2xl shadow-xl object-cover')}
          </div>
          <div class="{isLargeLeft ? 'md:col-span-2' : ''}">
            {@render contentEl('')}
          </div>
        {:else}
          <div class="{isLargeRight ? 'md:col-span-2' : ''}">
            {@render contentEl('')}
          </div>
          <div class="{isLargeRight ? 'md:col-span-3' : ''}">
            {@render imgEl('w-full rounded-2xl shadow-xl object-cover')}
          </div>
        {/if}
      </div>
    </section>
  {/if}

{:else if block.type === 'checkout'}
  {@const b = block}
  {@const v = b.variant ?? 'default'}
  {@const sty = getBlockStyle(b.blockStyle)}
  {@const overlay = hasOverlay(b.blockStyle)}

  {#snippet paymentMethodSelector()}
    {#if availableBlockMethods.length > 1}
      <div class="space-y-1.5">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1">Zahlungsmethode</p>
        {#each availableBlockMethods as method}
          {@const isSelected = selectedPaymentMethod === method.id}
          <button
            type="button"
            onclick={() => selectedPaymentMethod = method.id}
            class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border-2 transition-all text-left group
              {isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:border-border bg-card/60 hover:bg-card'}"
          >
            <!-- Radio indicator -->
            <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
              {isSelected ? 'border-primary' : 'border-muted-foreground/40 group-hover:border-muted-foreground/70'}">
              {#if isSelected}
                <div class="w-2 h-2 rounded-full bg-primary"></div>
              {/if}
            </div>
            <!-- Brand icon -->
            <div class="w-11 h-7 rounded-md overflow-hidden shrink-0 shadow-sm">
              {@html getMethodIcon(method.id)}
            </div>
            <!-- Label -->
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm leading-tight {isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}">{method.label}</p>
              <p class="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">{method.sub}</p>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/snippet}

  {#snippet billingForm()}
    <div class="space-y-3 rounded-xl border border-border/40 bg-muted/10 p-4">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rechnungsadresse</p>

      <div class="grid grid-cols-1 gap-2">
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">Vor- & Nachname</label>
          <input type="text" bind:value={billingName} placeholder="Max Mustermann"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">E-Mail-Adresse</label>
          <input type="email" bind:value={billingEmail} placeholder="max@example.com"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">Straße & Hausnummer</label>
          <input type="text" bind:value={billingStreet} placeholder="Musterstraße 1"
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div class="grid grid-cols-5 gap-2">
          <div class="col-span-2 space-y-1">
            <label class="text-xs text-muted-foreground">PLZ</label>
            <input type="text" bind:value={billingZip} placeholder="10115"
              class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div class="col-span-3 space-y-1">
            <label class="text-xs text-muted-foreground">Ort</label>
            <input type="text" bind:value={billingCity} placeholder="Berlin"
              class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">Land</label>
          <select bind:value={billingCountry}
            class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
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
            <option value="NO">Norwegen</option>
            <option value="PT">Portugal</option>
            <option value="GR">Griechenland</option>
            <option value="HU">Ungarn</option>
            <option value="RO">Rumänien</option>
            <option value="SK">Slowakei</option>
            <option value="HR">Kroatien</option>
            <option value="BG">Bulgarien</option>
            <option value="EE">Estland</option>
            <option value="LV">Lettland</option>
            <option value="LT">Litauen</option>
            <option value="SI">Slowenien</option>
            <option value="GB">Vereinigtes Königreich</option>
            <option value="US">USA</option>
            <option value="CA">Kanada</option>
            <option value="AU">Australien</option>
            <option value="NZ">Neuseeland</option>
            <option value="JP">Japan</option>
            <option value="SG">Singapur</option>
            <option value="AE">Vereinigte Arabische Emirate</option>
            <option value="SA">Saudi-Arabien</option>
            <option value="TR">Türkei</option>
            <option value="IL">Israel</option>
            <option value="ZA">Südafrika</option>
            <option value="BR">Brasilien</option>
            <option value="MX">Mexiko</option>
            <option value="AR">Argentinien</option>
            <option value="IN">Indien</option>
            <option value="CN">China</option>
            <option value="KR">Südkorea</option>
          </select>
        </div>
      </div>

      {#if reverseChargeEnabled}
        <div class="border-t border-border/30 pt-3 space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={isBusiness} class="rounded border-input" />
            <span class="text-sm font-medium text-foreground">Ich kaufe als Unternehmen (B2B)</span>
          </label>
          {#if isBusiness}
            <div class="space-y-1">
              <label class="text-xs text-muted-foreground">USt-IdNr. (z.B. DE123456789)</label>
              <input type="text" bind:value={billingVatId} placeholder="DE123456789"
                class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/20"
                oninput={(e) => { billingVatId = (e.target as HTMLInputElement).value.toUpperCase(); }} />
              {#if reverseChargeApplies}
                <p class="text-xs text-green-700 dark:text-green-400">✓ Reverse Charge — 0% MwSt. (§13b UStG)</p>
              {:else}
                <p class="text-xs text-muted-foreground">EU-USt-IdNr. aus einem anderen Land als {operatorCountry} eingeben.</p>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet paymentActions(btnStyle_: string)}
    <!-- Order total with tax breakdown (always shown) -->
    <div class="rounded-xl border border-border/40 bg-muted/20 px-3 py-2 space-y-1 text-sm">
      {#if effectiveVatRate > 0 || reverseChargeApplies || isNonEU}
        <div class="flex justify-between text-muted-foreground">
          <span>Nettobetrag</span>
          <span>{formatPrice(netTotal)}</span>
        </div>
        {#if isNonEU}
          <div class="flex justify-between text-green-700 dark:text-green-400 text-xs">
            <span>Steuerfreie Lieferung (Drittland)</span>
            <span>0,00 €</span>
          </div>
        {:else if reverseChargeApplies}
          <div class="flex justify-between text-green-700 dark:text-green-400 text-xs">
            <span>MwSt. (Reverse Charge §13b)</span>
            <span>0,00 €</span>
          </div>
        {:else}
          <div class="flex justify-between text-muted-foreground">
            <span>MwSt. ({effectiveVatRate}%)</span>
            <span>{formatPrice(vatAmount)}</span>
          </div>
        {/if}
      {/if}
      <div class="flex justify-between font-semibold text-foreground {effectiveVatRate > 0 || reverseChargeApplies || isNonEU ? 'border-t border-border/40 pt-1' : ''}">
        <span>Gesamt</span>
        <span>{formatPrice(chargeTotal)}</span>
      </div>
    </div>

    {#if isStripePayment}
      <div class="space-y-1.5">
        <label class="flex items-center gap-1.5 text-xs text-muted-foreground"><Tag class="w-3 h-3" /> Gutscheincode (optional)</label>
        {#if appliedCoupon}
          <div class="flex items-center justify-between bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
            <div class="flex items-center gap-2">
              <CheckCircle2 class="w-3.5 h-3.5 text-green-600 shrink-0" />
              <span class="text-sm font-medium text-green-700 dark:text-green-400">{appliedCoupon.code}</span>
              <span class="text-xs text-green-600">
                {appliedCoupon.discountType === 'percentage' ? `-${appliedCoupon.discountValue}%` : `-${formatPrice(appliedCoupon.discountValue)} €`}
              </span>
            </div>
            <button type="button" onclick={() => { appliedCoupon = null; couponCode = ''; }}
              class="text-muted-foreground hover:text-foreground ml-2 text-xs underline">×</button>
          </div>
        {:else}
          <div class="flex gap-2">
            <input class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
              bind:value={couponCode} placeholder="SAVE20"
              oninput={(e) => { couponCode = (e.target as HTMLInputElement).value.toUpperCase(); couponError = ''; }}
              onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }} />
            <button type="button" onclick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
              class="rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 shrink-0">
              {couponLoading ? '…' : 'Anwenden'}
            </button>
          </div>
          {#if couponError}<p class="text-xs text-destructive">{couponError}</p>{/if}
        {/if}
      </div>
      <button onclick={handleCheckout} disabled={isCheckoutLoading} style={btnStyle_}
        class="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm">
        {#if isCheckoutLoading}
          <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Wird verarbeitet...
        {:else}
          <ShoppingCart class="w-4 h-4" /> Jetzt zahlen · {formatPrice(chargeTotal)}
        {/if}
      </button>
      <div class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock class="w-3 h-3" /> Gesichert durch Stripe
      </div>
    {:else}
      {#if couponError}<p class="text-xs text-destructive text-center">{couponError}</p>{/if}
      <div bind:this={paypalContainer} class="min-h-[50px]">
        {#if !paypalLoaded}
          <div class="flex items-center justify-center h-12 text-xs text-muted-foreground">
            <svg class="animate-spin w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            PayPal wird geladen...
          </div>
        {/if}
      </div>
      <div class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock class="w-3 h-3" /> Gesichert durch PayPal
      </div>
    {/if}
  {/snippet}

  <section id="checkout-block" class="relative py-16 md:py-24 px-6" style={sty}>
    {#if overlay}<div class="absolute inset-0 z-0" style="background: rgba(0,0,0,{b.blockStyle!.bgImageOverlay})"></div>{/if}
    <div class="relative z-10 max-w-6xl mx-auto">
      {#if b.headline}
        <h2 class="text-3xl md:text-4xl font-serif font-semibold text-center mb-3 text-foreground" style={hlStyle(b.blockStyle)}>{b.headline}</h2>
      {/if}
      {#if b.subtext}
        <p class="text-center text-muted-foreground mb-8" style={subStyle(b.blockStyle)}>{b.subtext}</p>
      {/if}

      {#if v === 'minimal'}
        <!-- Minimal: method selector + billing + pay button centered -->
        <div class="max-w-sm mx-auto space-y-4">
          {@render paymentMethodSelector()}
          {@render billingForm()}
          {@render paymentActions(btnStyle(b.blockStyle))}
        </div>

      {:else if v === 'split'}
        <!-- Split: left=customer info, right=product+price+bumps+payment -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">

          <!-- Left: billing form -->
          <div>
            {@render billingForm()}
          </div>

          <!-- Right: product → price → bumps → payment (sticky) -->
          <div class="space-y-4 lg:sticky lg:top-8 lg:self-start">

            <!-- Product card: line items + tax breakdown -->
            <div class="bg-card border rounded-xl overflow-hidden">
              <div class="p-5 border-b border-border/40">
                <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Deine Bestellung</p>

                <!-- Main course -->
                <div class="flex items-start gap-3">
                  {#if courseThumbnailUrl}
                    <img src={courseThumbnailUrl} alt={courseTitle ?? ''} class="w-16 h-11 object-cover rounded-lg shrink-0" />
                  {/if}
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold text-foreground leading-snug">{courseTitle ?? 'Kurs'}</p>
                  </div>
                  <span class="font-bold text-foreground shrink-0">{formatPrice(coursePrice ?? 0)}</span>
                </div>

                <!-- Selected upsells as line items -->
                {#each (courseUpsells ?? []).filter((u: any) => selectedUpsells[u.id]) as upsell (upsell.id)}
                  {@const dp = getUpsellPrice(upsell)}
                  <div class="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-foreground leading-snug">{upsell.label || upsell.upsellCourse.title}</p>
                      {#if upsell.discountPercent > 0}
                        <span class="text-[10px] text-green-600">-{upsell.discountPercent}% Rabatt</span>
                      {/if}
                    </div>
                    <span class="text-sm font-semibold text-foreground shrink-0">{formatPrice(dp)}</span>
                  </div>
                {/each}
              </div>

              <!-- Tax breakdown + total -->
              <div class="px-5 py-3 space-y-1 text-xs text-muted-foreground bg-muted/20">
                {#if effectiveVatRate > 0 || reverseChargeApplies || isNonEU}
                  <div class="flex justify-between">
                    <span>Nettobetrag</span>
                    <span>{formatPrice(netTotal)}</span>
                  </div>
                  {#if isNonEU}
                    <div class="flex justify-between text-green-700 dark:text-green-400">
                      <span>Steuerfreie Lieferung (Drittland)</span>
                      <span>0,00 €</span>
                    </div>
                  {:else if reverseChargeApplies}
                    <div class="flex justify-between text-green-700 dark:text-green-400">
                      <span>MwSt. (Reverse Charge §13b)</span>
                      <span>0,00 €</span>
                    </div>
                  {:else}
                    <div class="flex justify-between">
                      <span>MwSt. ({effectiveVatRate}%)</span>
                      <span>{formatPrice(vatAmount)}</span>
                    </div>
                  {/if}
                {/if}
                {#if appliedCoupon && discountAmount > 0}
                  <div class="flex justify-between text-green-600">
                    <span>Rabatt ({appliedCoupon.code})</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                {/if}
                <div class="flex justify-between font-semibold text-foreground {effectiveVatRate > 0 || reverseChargeApplies || isNonEU || (appliedCoupon && discountAmount > 0) ? 'border-t border-border/40 pt-1' : ''}">
                  <span>Gesamt</span>
                  <span>{formatPrice(chargeTotal)}</span>
                </div>
              </div>
            </div>

            <!-- Order bumps -->
            {#each courseUpsells ?? [] as upsell}
              {@const dp = getUpsellPrice(upsell)}
              <label for="upsell-s-{upsell.id}" class="block cursor-pointer">
                <div class="bg-card border-2 rounded-xl p-4 transition-colors {selectedUpsells[upsell.id] ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/30 hover:border-muted-foreground/60'}">
                  <div class="flex items-start gap-3">
                    <div class="w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors shrink-0 {selectedUpsells[upsell.id] ? 'bg-primary border-primary' : 'border-muted-foreground/40'}">
                      {#if selectedUpsells[upsell.id]}<CheckCircle2 class="w-3 h-3 text-primary-foreground" />{/if}
                    </div>
                    <input type="checkbox" id="upsell-s-{upsell.id}" class="sr-only" bind:checked={selectedUpsells[upsell.id]} />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="text-[10px] font-semibold uppercase tracking-wide bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">Add-on</span>
                        {#if upsell.discountPercent > 0}
                          <span class="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">-{upsell.discountPercent}%</span>
                        {/if}
                      </div>
                      <p class="font-semibold text-sm text-foreground">{upsell.label || upsell.upsellCourse.title}</p>
                      {#if upsell.upsellCourse.subtitle}<p class="text-xs text-muted-foreground mt-0.5">{upsell.upsellCourse.subtitle}</p>{/if}
                    </div>
                    <div class="text-right shrink-0">
                      {#if upsell.discountPercent > 0}<div class="text-xs text-muted-foreground line-through">{formatPrice(upsell.upsellCourse.price)}</div>{/if}
                      <div class="font-bold text-sm {upsell.discountPercent > 0 ? 'text-green-700' : 'text-foreground'}">{formatPrice(dp)}</div>
                    </div>
                  </div>
                </div>
              </label>
            {/each}

            <!-- Payment: method selector + coupon + button -->
            <div class="bg-card border rounded-xl p-5 space-y-4">
              {@render paymentMethodSelector()}
              {#if isStripePayment}
                <div class="space-y-1.5">
                  <label class="flex items-center gap-1.5 text-xs text-muted-foreground"><Tag class="w-3 h-3" /> Gutscheincode (optional)</label>
                  {#if appliedCoupon}
                    <div class="flex items-center justify-between bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
                      <div class="flex items-center gap-2">
                        <CheckCircle2 class="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <span class="text-sm font-medium text-green-700 dark:text-green-400">{appliedCoupon.code}</span>
                        <span class="text-xs text-green-600">{appliedCoupon.discountType === 'percentage' ? `-${appliedCoupon.discountValue}%` : `-${formatPrice(appliedCoupon.discountValue)} €`}</span>
                      </div>
                      <button type="button" onclick={() => { appliedCoupon = null; couponCode = ''; }}
                        class="text-muted-foreground hover:text-foreground ml-2 text-xs underline">×</button>
                    </div>
                  {:else}
                    <div class="flex gap-2">
                      <input class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                        bind:value={couponCode} placeholder="SAVE20"
                        oninput={(e) => { couponCode = (e.target as HTMLInputElement).value.toUpperCase(); couponError = ''; }}
                        onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }} />
                      <button type="button" onclick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
                        class="rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 shrink-0">
                        {couponLoading ? '…' : 'Anwenden'}
                      </button>
                    </div>
                    {#if couponError}<p class="text-xs text-destructive">{couponError}</p>{/if}
                  {/if}
                </div>
                <button onclick={handleCheckout} disabled={isCheckoutLoading} style={btnStyle(b.blockStyle)}
                  class="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm">
                  {#if isCheckoutLoading}
                    <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Wird verarbeitet...
                  {:else}
                    <ShoppingCart class="w-4 h-4" /> Jetzt zahlen · {formatPrice(chargeTotal)}
                  {/if}
                </button>
                <div class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock class="w-3 h-3" /> Gesichert durch Stripe
                </div>
              {:else}
                {#if couponError}<p class="text-xs text-destructive text-center">{couponError}</p>{/if}
                <div bind:this={paypalContainer} class="min-h-[50px]">
                  {#if !paypalLoaded}
                    <div class="flex items-center justify-center h-12 text-xs text-muted-foreground">
                      <svg class="animate-spin w-3 h-3 mr-2" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      PayPal wird geladen...
                    </div>
                  {/if}
                </div>
                <div class="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Lock class="w-3 h-3" /> Gesichert durch PayPal
                </div>
              {/if}
            </div>

          </div>
        </div>

      {:else}
        <!-- Default: centered layout -->
        <div class="max-w-2xl mx-auto space-y-4">
          <!-- Upsells -->
          {#each courseUpsells ?? [] as upsell}
            {@const dp = getUpsellPrice(upsell)}
            <label for="upsell-d-{upsell.id}" class="block cursor-pointer">
              <div class="bg-card border-2 rounded-xl p-5 transition-colors {selectedUpsells[upsell.id] ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/30 hover:border-muted-foreground/60'}">
                <div class="flex items-start gap-4">
                  <div class="w-6 h-6 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors {selectedUpsells[upsell.id] ? 'bg-primary border-primary' : 'border-muted-foreground/40'}">
                    {#if selectedUpsells[upsell.id]}<CheckCircle2 class="w-4 h-4 text-primary-foreground" />{/if}
                  </div>
                  <input type="checkbox" id="upsell-d-{upsell.id}" class="sr-only" bind:checked={selectedUpsells[upsell.id]} />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-xs font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"><Plus class="w-3 h-3 inline mr-0.5" />Add-on</span>
                      {#if upsell.discountPercent > 0}<span class="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{upsell.discountPercent}% off</span>{/if}
                    </div>
                    <p class="font-semibold text-foreground">{upsell.label || upsell.upsellCourse.title}</p>
                    {#if upsell.upsellCourse.subtitle}<p class="text-sm text-muted-foreground mt-0.5">{upsell.upsellCourse.subtitle}</p>{/if}
                  </div>
                  <div class="text-right shrink-0">
                    {#if upsell.discountPercent > 0}<div class="text-xs text-muted-foreground line-through">{formatPrice(upsell.upsellCourse.price)}</div>{/if}
                    <div class="text-lg font-bold {upsell.discountPercent > 0 ? 'text-green-700' : 'text-foreground'}">{formatPrice(dp)}</div>
                  </div>
                </div>
              </div>
            </label>
          {/each}

          <!-- Payment method selector -->
          {@render paymentMethodSelector()}

          <!-- Billing form -->
          {@render billingForm()}

          <!-- Payment action (includes tax breakdown + total + pay button) -->
          {@render paymentActions(btnStyle(b.blockStyle))}
        </div>
      {/if}
    </div>
  </section>
{:else if block.type === 'order_summary'}
  {@const b = block as any}
  {@const amount = purchaseAmount ?? coursePrice}
  {@const isCompact = b.variant === 'compact'}
  <section class="py-16 px-4 bg-background">
    <div class="max-w-xl mx-auto {isCompact ? 'space-y-4' : 'space-y-8'}">
      <!-- Confirmation header -->
      <div class="text-center space-y-2">
        <div class="flex justify-center">
          <div class="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
            <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        {#if b.headline}
          <h1 class="text-3xl font-serif font-bold">{b.headline}</h1>
        {/if}
        {#if b.subtext}
          <p class="text-muted-foreground">{b.subtext}</p>
        {/if}
      </div>

      <!-- Order card -->
      <div class="border rounded-xl overflow-hidden bg-card shadow-sm">
        {#if courseThumbnailUrl}
          <img src={courseThumbnailUrl} alt={courseTitle ?? ''} class="w-full {isCompact ? 'h-36' : 'h-52'} object-cover" />
        {/if}
        <div class="p-6 space-y-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-wider text-muted-foreground mb-1">Gekaufter Kurs</p>
              <p class="font-semibold text-lg">{courseTitle ?? 'Dein Kurs'}</p>
            </div>
            {#if amount != null}
              <div class="text-right shrink-0">
                <p class="text-xs uppercase tracking-wider text-muted-foreground mb-1">Betrag</p>
                <p class="font-bold text-xl">€{(amount / 100).toFixed(2).replace('.', ',')}</p>
              </div>
            {/if}
          </div>
          <div class="pt-2 border-t">
            <a
              href="/my-courses"
              class="block w-full text-center px-6 py-3 rounded-lg font-semibold transition-colors"
              style="background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground));"
            >
              {b.ctaText || 'Jetzt zum Kurs'}
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
{:else if block.type === 'custom_html'}
  {@const b = block as any}
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html b.html ?? ''}
{:else if block.type === 'custom_css'}
  <!-- CSS injected into <head> via onMount -->
{/if}
