const PAYPAL_BASE = {
	sandbox: 'https://api-m.sandbox.paypal.com',
	live: 'https://api-m.paypal.com',
};

async function getAccessToken(clientId: string, clientSecret: string, sandbox: boolean): Promise<string> {
	const base = sandbox ? PAYPAL_BASE.sandbox : PAYPAL_BASE.live;
	const res = await fetch(`${base}/v1/oauth2/token`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: 'grant_type=client_credentials',
	});
	if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
	const data = await res.json();
	return data.access_token as string;
}

export interface PayPalConfig {
	clientId: string;
	clientSecret: string;
	sandbox: boolean;
}

export async function createPayPalOrder(
	config: PayPalConfig,
	items: Array<{ name: string; amount: number }> // amount in cents
): Promise<{ id: string }> {
	const base = config.sandbox ? PAYPAL_BASE.sandbox : PAYPAL_BASE.live;
	const token = await getAccessToken(config.clientId, config.clientSecret, config.sandbox);
	const total = items.reduce((s, i) => s + i.amount, 0);

	const res = await fetch(`${base}/v2/checkout/orders`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			intent: 'CAPTURE',
			purchase_units: [{
				amount: {
					currency_code: 'EUR',
					value: (total / 100).toFixed(2),
					breakdown: { item_total: { currency_code: 'EUR', value: (total / 100).toFixed(2) } },
				},
				items: items.map(i => ({
					name: i.name.substring(0, 127),
					unit_amount: { currency_code: 'EUR', value: (i.amount / 100).toFixed(2) },
					quantity: '1',
				})),
			}],
		}),
	});
	if (!res.ok) throw new Error(`PayPal create order failed: ${await res.text()}`);
	return res.json();
}

/**
 * Verifies a webhook delivery via PayPal's verify-webhook-signature API.
 * The raw body is embedded verbatim: re-serialising the parsed event can change it
 * (number formatting, key order) and make PayPal report FAILURE.
 */
export async function verifyPayPalWebhook(
	config: PayPalConfig & { webhookId: string },
	headers: Headers,
	rawBody: string
): Promise<boolean> {
	const h = (name: string) => headers.get(name) ?? '';
	if (!h('paypal-transmission-id') || !h('paypal-transmission-sig')) return false;

	const base = config.sandbox ? PAYPAL_BASE.sandbox : PAYPAL_BASE.live;
	const token = await getAccessToken(config.clientId, config.clientSecret, config.sandbox);
	const fields = JSON.stringify({
		auth_algo: h('paypal-auth-algo'),
		cert_url: h('paypal-cert-url'),
		transmission_id: h('paypal-transmission-id'),
		transmission_sig: h('paypal-transmission-sig'),
		transmission_time: h('paypal-transmission-time'),
		webhook_id: config.webhookId,
	});
	const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: `${fields.slice(0, -1)},"webhook_event":${rawBody}}`,
	});
	if (!res.ok) throw new Error(`PayPal webhook verification failed: ${await res.text()}`);
	const data = await res.json();
	return data.verification_status === 'SUCCESS';
}

/** Fetches a capture (status, amount and the order it belongs to). */
export async function getPayPalCapture(config: PayPalConfig, captureId: string): Promise<any> {
	const base = config.sandbox ? PAYPAL_BASE.sandbox : PAYPAL_BASE.live;
	const token = await getAccessToken(config.clientId, config.clientSecret, config.sandbox);
	const res = await fetch(`${base}/v2/payments/captures/${encodeURIComponent(captureId)}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) throw new Error(`PayPal get capture failed: ${await res.text()}`);
	return res.json();
}

export async function capturePayPalOrder(config: PayPalConfig, orderId: string): Promise<any> {
	const base = config.sandbox ? PAYPAL_BASE.sandbox : PAYPAL_BASE.live;
	const token = await getAccessToken(config.clientId, config.clientSecret, config.sandbox);
	const res = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
	});
	if (!res.ok) throw new Error(`PayPal capture failed: ${await res.text()}`);
	return res.json();
}

export interface PayPalTransaction {
	id: string;              // capture id for payments, refund id for refunds
	referenceId: string | null; // e.g. the original capture for a refund
	eventCode: string;       // T0006 payment, T1107 refund, T04xx withdrawal, T12xx reversal …
	status: string;
	date: Date;
	amountCents: number;     // signed: negative for money leaving the account
	feeCents: number;        // signed: negative for fees charged
	currency: string;
}

/**
 * Money movements on the PayPal account (Transaction Search API; needs the "Transaction search"
 * feature enabled on the REST app). Range is split into ≤ 31-day windows as the API requires.
 */
export async function listPayPalTransactions(config: PayPalConfig, from: Date, to: Date): Promise<PayPalTransaction[]> {
	const base = config.sandbox ? PAYPAL_BASE.sandbox : PAYPAL_BASE.live;
	const token = await getAccessToken(config.clientId, config.clientSecret, config.sandbox);
	const toCents = (a: any) => Math.round(parseFloat(a?.value ?? '0') * 100);
	const result: PayPalTransaction[] = [];

	for (let start = from.getTime(); start < to.getTime(); start += 31 * 86_400_000) {
		const end = Math.min(start + 31 * 86_400_000, to.getTime());
		for (let page = 1, totalPages = 1; page <= totalPages; page++) {
			const params = new URLSearchParams({
				start_date: new Date(start).toISOString(),
				end_date: new Date(end - 1).toISOString(),
				fields: 'transaction_info',
				page_size: '500',
				page: String(page),
			});
			const res = await fetch(`${base}/v1/reporting/transactions?${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error(`PayPal transaction search failed: ${await res.text()}`);
			const data = await res.json();
			totalPages = data.total_pages ?? 1;
			for (const d of data.transaction_details ?? []) {
				const t = d.transaction_info ?? {};
				result.push({
					id: t.transaction_id,
					referenceId: t.paypal_reference_id ?? null,
					eventCode: t.transaction_event_code ?? '',
					status: t.transaction_status ?? '',
					date: new Date(t.transaction_initiation_date),
					amountCents: toCents(t.transaction_amount),
					feeCents: toCents(t.fee_amount),
					currency: (t.transaction_amount?.currency_code ?? 'EUR').toLowerCase(),
				});
			}
		}
	}
	return result;
}
