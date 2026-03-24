import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

let _instance: Stripe | null = null;
let _instanceKey: string | undefined;

export function getStripeClient(key: string): Stripe {
	if (!_instance || _instanceKey !== key) {
		_instance = new Stripe(key, {
			apiVersion: '2025-01-27.acacia' as any,
			typescript: true,
		});
		_instanceKey = key;
	}
	return _instance;
}

// Lazy proxy — does not throw at module load, only when actually called without a key.
// Existing callers using `stripe.xxx.yyy()` continue to work unchanged.
export const stripe = new Proxy({} as Stripe, {
	get(_, prop) {
		const key = env.STRIPE_SECRET_KEY;
		if (!key) throw new Error('Stripe is not configured. Please complete the setup wizard or set STRIPE_SECRET_KEY.');
		return (getStripeClient(key) as any)[prop];
	},
});
