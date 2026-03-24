import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';

export const load = async ({ request }) => {
    const session = await auth.api.getSession({
        headers: request.headers
    });

    // Attempt to get site settings, or use defaults
    const settings = await db.query.siteSettings.findFirst();

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
