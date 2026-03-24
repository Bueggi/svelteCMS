<script lang="ts">
  import type { Block } from './types';
  import BlockRenderer from './BlockRenderer.svelte';

  let { blocks, courseSlug, coursePrice, courseTitle, courseThumbnailUrl, courseId, courseUpsells, checkoutMode, enabledMethods, paypalClientId, vatRate = 0, reverseChargeEnabled = false, operatorCountry = 'DE', taxRates = [], funnelSlug, funnelCheckoutPageId, purchaseAmount, sandboxMode = false }: {
    blocks: Block[];
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
</script>

{#each blocks as block (block.id)}
  <BlockRenderer {block} {courseSlug} {coursePrice} {courseTitle} {courseThumbnailUrl} {courseId} {courseUpsells} {checkoutMode} {enabledMethods} {paypalClientId} {vatRate} {reverseChargeEnabled} {operatorCountry} {taxRates} {funnelSlug} {funnelCheckoutPageId} {purchaseAmount} {sandboxMode} />
{/each}
