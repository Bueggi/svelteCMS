# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LUMIÈRE** — A SvelteKit-based Learning Management System (LMS) with eCommerce for a premium skincare brand. Features course management, Stripe payments, community forums, and a rich admin panel.

## Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Run production build
npm run check        # Type check (svelte-check)
npm run lint         # Check formatting (prettier)
npm run format       # Auto-format code

# Database
npm run db:start     # Start local PostgreSQL via Docker Compose
npm run db:push      # Push schema changes directly (dev only)
npm run db:generate  # Generate migration files from schema changes
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio UI
npm run db:seed      # Run seed.ts
```

There is no test runner script. Schema tests exist at `src/lib/server/db/schema.test.ts`.

## Architecture

### Route Groups
- `(site)/` — Public pages (homepage, course catalog, auth)
- `(app)/` — Authenticated user area (dashboard, course player, community, settings)
- `(app)/admin/` — Admin panel (role-gated, `userRoleEnum`: admin/instructor/moderator/student)
- `api/` — API routes (Better Auth handler, Stripe checkout/webhook, file upload)

### Data Flow Pattern
All mutations use SvelteKit form actions in `+page.server.ts`. Data loading happens server-side. Client-side uses `use:enhance` for progressive enhancement without full page reloads.

### Authentication
Better Auth (`src/lib/server/auth.ts`) with Drizzle adapter. Session injected into `locals.user` / `locals.session` via `hooks.server.ts`. Social OAuth providers (GitHub, Google, Discord) are conditional on env vars. Client-side auth utilities in `src/lib/auth-client.ts`.

### Database
Drizzle ORM + PostgreSQL. Schema in `src/lib/server/db/schema.ts`. The Drizzle client is a singleton in `src/lib/server/db/index.ts` to prevent multiple connections in dev. Use `npm run db:push` for quick schema iteration during development; use `db:generate` + `db:migrate` for production migrations.

### First-run setup (no `.env` required)
`DATABASE_URL` and `BETTER_AUTH_SECRET` may come from the environment **or** from `data/config.json` (path via `CONFIG_FILE`), which the `/setup` wizard writes (step 0: connection string → connection test → schema creation on an empty DB → generated auth secret). Env vars always win; `src/lib/server/config.ts` is the single reader. `db` and `auth` are lazy proxies so the app boots without a database. The wizard is locked behind a setup token (`src/lib/server/setup-token.ts`, printed to the server log, or pinned via `SETUP_TOKEN`) and every wizard action calls `assertSetupOpen` — actions run without `load`, so guard them there, not only in `load`.

The `drizzle/` folder is a single baseline migration generated from `schema.ts`; the wizard applies it with `migrate()`. Schema changes now need `npm run db:generate` (a schema change without a migration means fresh installs miss it). `drizzle-kit push` remains fine for local iteration.

### Payments
Stripe integration: checkout session creation at `api/stripe/checkout/+server.ts`, webhook handler at `api/stripe/webhook/+server.ts`. Commerce entities: `purchases`, `coupons`, `upsells` (order bumps). Coupons support percentage or fixed-amount discounts, either globally or per-course.

### LMS Structure
Hierarchy: Course → Module → Lesson. Lessons have types (`video`, `text`, `quiz`) and support drip scheduling (unlock N days after enrollment). User progress tracked in `userProgress` table. Enrollments support `lifetime`, `duration`, and `subscription` access types.

## UI Component System

Reusable components live in `src/lib/components/ui/`. Use these instead of building inline:

| Component | Usage |
|-----------|-------|
| `PageContainer` | Outer layout wrapper, accepts `variant="admin"` or `variant="app"` |
| `PageHeader` | Page title + description + action slot |
| `Table` / `TableHeader` / `TableBody` | Data tables |
| `StatusBadge` | Status indicators with color variants |
| `StatCard` | Dashboard metric cards |
| `SectionCard` | Settings section wrapper |
| `FormSelect` | Styled `<select>` element |

The rich text editor (`RichTextEditor.svelte`) is Tiptap-based and used for lesson content.

## Design System

Brand: LUMIÈRE (luxury skincare). All colors are CSS variables defined in `src/routes/+layout.svelte` and extended in `tailwind.config.js`.

- **Headlines:** Cormorant Garamond (serif), `font-medium`/`font-semibold`
- **Body:** Inter (sans)
- **Key colors:** `rose-gold`, `gold`, `gold-light`, `cream` — accessed via Tailwind classes like `bg-rose-gold` or `text-gold`
- **Dark mode:** Class-based (`dark:`)

See `styleguide.md` for the full brand/component style guide.

## Environment Variables

```
DATABASE_URL                          # PostgreSQL connection string
BETTER_AUTH_SECRET                    # Session signing key
BETTER_AUTH_URL                       # Auth base URL (e.g. http://localhost:5173)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET
# SMTP vars for Nodemailer (email verification, password reset, welcome emails)
```

Local PostgreSQL via `compose.yaml`: `postgres://root:mysecretpassword@localhost:5432/local`

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/server/db/schema.ts` | Complete DB schema (all tables, enums, relations) |
| `src/lib/server/auth.ts` | Better Auth configuration |
| `src/hooks.server.ts` | Session loading middleware |
| `src/lib/themes.ts` | Theme color definitions |
| `src/lib/constants.ts` | App-wide constants |
| `styleguide.md` | Brand/design system reference |
