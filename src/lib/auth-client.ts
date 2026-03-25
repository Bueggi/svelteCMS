import { createAuthClient } from "better-auth/svelte";
import { env } from "$env/dynamic/public";
import type { auth } from "./server/auth";

export const authClient = createAuthClient({
    baseURL: env.PUBLIC_BETTER_AUTH_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
    inferAdditionalFields: {} as typeof auth
});

