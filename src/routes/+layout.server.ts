import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { auth } from '$lib/server/auth';
import { isDatabaseConfigured } from '$lib/server/config';

const defaultSettings = {
    primaryColor: "15 60% 65%",
    secondaryColor: "38 70% 55%",
    accentColor: "15 60% 65%",
    backgroundColor: "40 33% 97%",
    foregroundColor: "30 10% 15%",
    activeTheme: "luxurious",
    defaultLanguage: "de"
};

export const load = async ({ request }) => {
    // Setup wizard before a database exists: nothing to load yet
    if (!isDatabaseConfigured()) {
        return { user: null, settings: defaultSettings };
    }

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
        settings: settings || defaultSettings
    };
};
