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
