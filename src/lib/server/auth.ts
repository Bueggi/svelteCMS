import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "./db/schema";
import { getDb } from "./db";
import { getAuthSecret } from "./config";
import { env } from "$env/dynamic/private";
import { sendMail } from "./email/mailer";
import { emailVerificationEmail, passwordResetEmail, welcomeEmail } from "./email/templates";
import { fireAutomations } from "./automations";

function createAuth() {
    const { BETTER_AUTH_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = env;

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

    return betterAuth({
        database: drizzleAdapter(getDb(), {
            provider: "pg",
            schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
            }
        }),
        baseURL: BETTER_AUTH_URL,
        secret: getAuthSecret(),
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
}

type Auth = ReturnType<typeof createAuth>;

// Created lazily: it needs the DB connection and secret, which may only exist after
// the /setup wizard has run. Call resetAuth() after that config changes.
let instance: Auth | undefined;

export function resetAuth(): void {
    instance = undefined;
}

export const auth: Auth = new Proxy({} as Auth, {
    get(_target, prop) {
        instance ??= createAuth();
        const value = Reflect.get(instance, prop);
        return typeof value === 'function' ? value.bind(instance) : value;
    },
});
