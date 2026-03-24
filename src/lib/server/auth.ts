import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "./db/schema";
import { env } from "$env/dynamic/private";

const { DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = env;
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sendMail } from "./email/mailer";
import { emailVerificationEmail, passwordResetEmail, welcomeEmail } from "./email/templates";
import { fireAutomations } from "./automations";

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

const socialProviders: any = {};

if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
    };
}

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
    };
}

if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
    socialProviders.discord = {
        clientId: DISCORD_CLIENT_ID,
        clientSecret: DISCORD_CLIENT_SECRET,
    };
}

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
        }
    }),
    baseURL: BETTER_AUTH_URL,
    secret: BETTER_AUTH_SECRET,
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, // set to true once SMTP is configured
        sendResetPassword: async ({ user, url }) => {
            await sendMail({
                to: user.email,
                subject: 'Passwort zurücksetzen',
                html: passwordResetEmail({ name: user.name, resetUrl: url }),
            });
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url }) => {
            await sendMail({
                to: user.email,
                subject: 'E-Mail-Adresse bestätigen',
                html: emailVerificationEmail({ name: user.name, verifyUrl: url }),
            });
        },
    },
    socialProviders,
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "student",
                input: false,
            },
        },
    },
    callbacks: {
        session: async ({ session, user }) => {
            return {
                session,
                user: {
                    ...user,
                    role: user.role,
                }
            };
        },
        // Send welcome email on first sign-up
        user: {
            created: async ({ user }: { user: any }) => {
                await sendMail({
                    to: user.email,
                    subject: 'Willkommen! 🎉',
                    html: welcomeEmail({
                        name: user.name,
                        loginUrl: `${BETTER_AUTH_URL}/login`,
                    }),
                });
                fireAutomations('user.created', {
                    user: { id: user.id, email: user.email, name: user.name, createdAt: new Date().toISOString() },
                });
            },
        },
    } as any,
});
