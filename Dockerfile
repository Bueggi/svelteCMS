# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production runner ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Production dependencies only (adapter-node externalizes everything in `dependencies`)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled app + DB migrations + the startup migration script
COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle ./drizzle
COPY scripts/migrate.js ./scripts/migrate.js

ENV PORT=3000 \
    # Uploads and the setup wizard's config live on volumes (see deploy/docker/docker-compose.yml)
    UPLOAD_DIR=/app/uploads \
    CONFIG_FILE=/app/data/config.json \
    # adapter-node defaults to 512 KB, but image uploads allow up to 8 MB
    BODY_SIZE_LIMIT=12M \
    # The in-app "update now" button needs git/pm2; in a container the update is `docker compose pull`
    DEPLOY_MODE=docker

RUN mkdir -p /app/uploads /app/data && chown -R node:node /app/uploads /app/data
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

# Apply pending migrations, then start the app
CMD ["sh", "-c", "node scripts/migrate.js && node build/index.js"]
