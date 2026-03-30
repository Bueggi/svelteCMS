import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';

export const load = async ({ request }) => {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    // Attempt to get site settings, or use defaults
    // Wrapped in try/catch to prevent full app crash if DB schema is out of sync
    let settings = null;
    try {
        settings = await db.query.siteSettings.findFirst();
    } catch {
        // Schema might be temporarily out of sync (e.g. pending migration)
    }

    return {
        user: session?.user || null,
        settings: settings || {
            primaryColor: "15 60% 65%",
            secondaryColor: "38 70% 55%",
            accentColor: "15 60% 65%",
            backgroundColor: "40 33% 97%",
            foregroundColor: "30 10% 15%",
            activeTheme: "luxurious",
            defaultLanguage: "de"
        }
    };
};
