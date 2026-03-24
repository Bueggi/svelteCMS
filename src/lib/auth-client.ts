import { createAuthClient } from "better-auth/svelte";
import type { auth } from "./server/auth";

export const authClient = createAuthClient({
    baseURL: "http://localhost:5173",
    inferAdditionalFields: {} as typeof auth
});

