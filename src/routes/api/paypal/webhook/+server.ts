import { json, error } from '@sveltejs/kit';
import { getPayPalConfig } from '$lib/server/settings';
import { getPayPalCapture, verifyPayPalWebhook, type PayPalConfig } from '$lib/server/paypal';
import {
	purchasesForOrder, targetsFromPurchases, revokeCourseAccess, restoreDisputedAccess,
} from '$lib/server/payment-events';
import { issueCorrection, sendInvoiceEmail, findInvoiceByPaymentReference } from '$lib/server/invoices';
import type { RequestHandler } from './$types';

// PayPal purchases are only recorded at capture time (api/paypal/capture-order), so without
// these events refunds and buyer-protection cases would leave the course access untouched.

const toCents = (amount: { value?: string } | undefined) => Math.round(parseFloat(amount?.value ?? '0') * 100);

/** Access targets for the order a capture belongs to (purchases are stored as `paypal_<orderId>`). */
async function targetsForCapture(capture: any) {
	const orderId = capture?.supplementary_data?.related_ids?.order_id;
	if (!orderId) {
		console.error('PayPal webhook: capture without order id', capture?.id);
		return [];
	}
	return targetsFromPurchases(await purchasesForOrder(`paypal_${orderId}`));
}

/** Captures named in a dispute (`seller_transaction_id` is the capture id). */
async function capturesForDispute(config: PayPalConfig, dispute: any) {
	const ids: string[] = (dispute?.disputed_transactions ?? [])
		.map((t: any) => t.seller_transaction_id)
		.filter(Boolean);
	return Promise.all(ids.map(id => getPayPalCapture(config, id)));
}

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();

	const config = await getPayPalConfig();
	if (!config?.webhookId) {
		console.error('PayPal webhook received, but no PayPal webhook ID is configured');
		return error(400, 'PayPal webhook not configured');
	}

	let verified = false;
	try {
		verified = await verifyPayPalWebhook({ ...config, webhookId: config.webhookId }, request.headers, rawBody);
	} catch (err) {
		console.error('PayPal webhook verification error:', err);
		// 5xx makes PayPal retry the delivery later
		return error(502, 'Verification unavailable');
	}
	if (!verified) {
		console.error('PayPal webhook signature verification failed');
		return error(400, 'Invalid signature');
	}

	const event = JSON.parse(rawBody);
	const resource = event.resource ?? {};

	try {
		switch (event.event_type) {
			// Fires for partial refunds too: every refund gets a correction document,
			// only a fully refunded capture revokes access
			case 'PAYMENT.CAPTURE.REFUNDED': {
				const captureHref: string | undefined = (resource.links ?? []).find((l: any) => l.rel === 'up')?.href;
				const captureId = captureHref?.split('/').pop();
				if (!captureId) break;

				const original = await findInvoiceByPaymentReference(captureId);
				if (original && resource.id) {
					const correctionId = await issueCorrection({
						original,
						refundedGrossCents: toCents(resource.amount),
						paymentReference: resource.id,
						refundedAt: resource.create_time ? new Date(resource.create_time) : new Date(),
					});
					await sendInvoiceEmail(correctionId);
				}

				const capture = await getPayPalCapture(config, captureId);
				if (capture.status !== 'REFUNDED') break;
				await revokeCourseAccess({
					targets: await targetsForCapture(capture),
					reason: 'refund',
					purchaseStatus: 'refunded',
					refundedAmount: toCents(capture.amount),
				});
				break;
			}

			// Funds pulled back by PayPal (e.g. chargeback through the buyer's card issuer)
			case 'PAYMENT.CAPTURE.REVERSED': {
				const capture = resource.supplementary_data?.related_ids?.order_id
					? resource
					: await getPayPalCapture(config, resource.id);
				await revokeCourseAccess({
					targets: await targetsForCapture(capture),
					reason: 'dispute',
					purchaseStatus: 'disputed',
				});
				break;
			}

			// Buyer opened a case (PayPal buyer protection)
			case 'CUSTOMER.DISPUTE.CREATED': {
				for (const capture of await capturesForDispute(config, resource)) {
					await revokeCourseAccess({
						targets: await targetsForCapture(capture),
						reason: 'dispute',
						purchaseStatus: 'disputed',
					});
				}
				break;
			}

			// Case closed in the seller's favour → access comes back
			case 'CUSTOMER.DISPUTE.RESOLVED': {
				if (resource.dispute_outcome?.outcome_code !== 'RESOLVED_SELLER_FAVOUR') break;
				for (const capture of await capturesForDispute(config, resource)) {
					await restoreDisputedAccess(await targetsForCapture(capture));
				}
				break;
			}
		}
	} catch (err) {
		console.error(`Error processing PayPal webhook ${event.event_type}:`, err);
		return error(500, 'Webhook processing failed');
	}

	return json({ received: true });
};
