#!/bin/bash
# ============================================================
# LUMIÈRE — Server-Side Self-Update Script
# Wird vom Node.js-Prozess gestartet, wenn der Admin auf
# "Jetzt updaten" klickt. Läuft als Hintergrundprozess.
# Log: /var/www/lumiere/update.log
# ============================================================
set -e

APP_DIR=/var/www/lumiere
LOG="$APP_DIR/update.log"

exec > >(tee "$LOG") 2>&1

echo ""
echo "======================================================"
echo "  LUMIÈRE Self-Update — $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

cd "$APP_DIR"

# 1. Aktuelle Version sichern (für Rollback-Hinweis)
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "[1/6] Aktueller Stand: $OLD_COMMIT"

# 2. Neuesten Stand vom Remote holen
echo "[2/6] git pull origin master..."
git reset --hard HEAD
git pull origin master --ff-only
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "      ✓ Neuer Stand: $NEW_COMMIT"

# 3. Dependencies aktualisieren (inkl. devDeps für den Build)
echo "[3/6] npm ci..."
npm ci --silent
npm rebuild sharp --silent 2>/dev/null || true
echo "      ✓ Dependencies aktualisiert"

# 4. Build
echo "[4/6] npm run build..."
npm run build
echo "      ✓ Build erfolgreich"

# 4b. Dev-Dependencies nach dem Build entfernen
npm prune --omit=dev --silent 2>/dev/null || true

# 5. Schema-Sync
echo "[5/6] drizzle-kit push..."
set -a && source "$APP_DIR/.env" && set +a
npx drizzle-kit push --config="$APP_DIR/drizzle.config.ts"
echo "      ✓ Schema synchronisiert"

# 6. Zero-Downtime-Neustart
echo "[6/6] pm2 reload lumiere..."
pm2 reload lumiere --update-env && pm2 save
echo "      ✓ App neu gestartet"

echo ""
echo "======================================================"
echo "  Update abgeschlossen! $OLD_COMMIT → $NEW_COMMIT"
echo "======================================================"
echo ""
