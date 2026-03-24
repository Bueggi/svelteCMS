# LUMIÈRE LMS

An open-source Learning Management System with integrated eCommerce, built with SvelteKit 5, Drizzle ORM, and Stripe.

## Features

- **Course Management** — Courses, modules, lessons (video, text, quiz), drip scheduling, progress tracking
- **eCommerce** — Stripe checkout, subscriptions with trial periods, coupons, upsells, order bumps
- **Sales Funnels** — Multi-step funnels with custom pages, checkout pages, upsell pages, tracking pixels, sandbox mode
- **Community** — Per-course forums with categories, threads, and replies
- **Invoicing** — Auto-generated PDF invoices with customizable templates, VAT/reverse charge support
- **Admin Panel** — Full course, funnel, user, and settings management
- **Multi-language** — UI translations in DE / EN / ES / FR
- **Auth** — Better Auth with email/password and optional OAuth (GitHub, Google, Discord)
- **Dark mode** — Class-based dark mode via `mode-watcher`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 5 (Runes) |
| Database | PostgreSQL + Drizzle ORM |
| Payments | Stripe (checkout, webhooks, subscriptions) |
| Auth | Better Auth |
| UI | Tailwind CSS v4, bits-ui, lucide-svelte |
| Email | Nodemailer |
| File uploads | Sharp (image processing) |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd lumiere-lms
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, BETTER_AUTH_SECRET, STRIPE_SECRET_KEY, etc.

# 3. Start local database
npm run db:start

# 4. Push schema
npm run db:push

# 5. Start dev server
npm run dev
```

### Make yourself an admin

After logging in for the first time:

```bash
npx tsx make_admin.ts your@email.com
```

### Seed test data (optional)

```bash
npx tsx seed-purchases.ts your@email.com
```

### Reset to a clean state

Wipes all user data (users, courses, purchases, media, settings) while keeping the schema:

```bash
npx tsx reset-db.ts
# or skip the confirmation prompt:
npx tsx reset-db.ts --yes
```

## Environment Variables

See `.env.example` for the full list. Key variables:

```
DATABASE_URL                 # PostgreSQL connection string
BETTER_AUTH_SECRET           # Session signing key (generate a random string)
BETTER_AUTH_URL              # Base URL of your app
STRIPE_SECRET_KEY            # Stripe live secret key
STRIPE_WEBHOOK_SECRET        # Stripe webhook endpoint secret
STRIPE_TEST_SECRET_KEY       # Stripe test key (for funnel sandbox mode)
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Run production build
npm run check        # Type check
npm run db:push      # Push schema changes (dev)
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio
```

## Deployment

The app uses `@sveltejs/adapter-node`. Build with `npm run build` and run with `node build/index.js`. Set all environment variables in your hosting environment.

For database migrations in production, use `npm run db:generate` + `npm run db:migrate` instead of `db:push`.

## License

MIT
