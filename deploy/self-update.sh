#!/bin/bash
# ============================================================
# LUMIÈRE — Server-Side Self-Update Script
# Wird vom Node.js-Prozess gestartet, wenn der Admin auf
# "Jetzt updaten" klickt. Läuft als Hintergrundprozess.
# Log: /var/www/lumiere/update.log
# ============================================================
APP_DIR=/var/www/lumiere
LOG="$APP_DIR/update.log"

exec > >(tee "$LOG") 2>&1

# On any error, write a clear failure message to the log
trap 'echo ""; echo "FEHLER: Update fehlgeschlagen in Schritt $CURRENT_STEP. Siehe Ausgabe oben." >&2' ERR
set -e

CURRENT_STEP=0

echo ""
echo "======================================================"
echo "  LUMIÈRE Self-Update — $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================"

cd "$APP_DIR"

# 1. Aktuelle Version sichern (für Rollback-Hinweis)
CURRENT_STEP=1
OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "[1/6] Aktueller Stand: $OLD_COMMIT"

# 2. Neuesten Stand vom Remote holen
CURRENT_STEP=2
echo "[2/6] git pull origin master..."
git reset --hard HEAD
git pull origin master --ff-only
NEW_COMMIT=$(git rev-parse --short HEAD)
echo "      ✓ Neuer Stand: $NEW_COMMIT"

# 3. Dependencies aktualisieren (inkl. devDeps für den Build)
CURRENT_STEP=3
echo "[3/6] npm ci..."
npm ci
npm rebuild sharp 2>/dev/null || true
echo "      ✓ Dependencies aktualisiert"

# 4. Build
CURRENT_STEP=4
echo "[4/6] npm run build..."
npm run build
npm prune --omit=dev 2>/dev/null || true
echo "      ✓ Build erfolgreich"

# 5. Schema-Sync
CURRENT_STEP=5
echo "[5/6] drizzle-kit push..."
set -a && source "$APP_DIR/.env" && set +a
npx drizzle-kit push --config="$APP_DIR/drizzle.config.ts"
echo "      ✓ Schema synchronisiert"

# 6. Zero-Downtime-Neustart
CURRENT_STEP=6
echo "[6/6] App wird neu gestartet..."

# Completion message BEFORE reload — browser detects it and reloads in 4s
echo ""
echo "======================================================"
echo "  Update abgeschlossen! $OLD_COMMIT → $NEW_COMMIT"
echo "======================================================"
echo ""

# Reload after writing completion to log (browser will reload the page)
pm2 reload lumiere --update-env && pm2 save || true
