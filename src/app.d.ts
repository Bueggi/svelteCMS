// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			// Inferred from the auth config so the additional `role` field is included
			user: typeof import("$lib/server/auth").auth.$Infer.Session.user | null;
			session: import("better-auth").Session | null;
			/** True once the visitor entered the setup token (always true in dev). */
			setupUnlocked: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
