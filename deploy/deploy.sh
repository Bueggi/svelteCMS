#!/bin/bash
# ============================================================
# LUMIÈRE — Deploy-Skript (lokal ausführen)
# Verwendung: bash deploy/deploy.sh [user@server-ip]
# Beispiel:   bash deploy/deploy.sh root@178.104.110.252
# ============================================================
set -e

SERVER="${1:-root@178.104.110.252}"
APP_DIR=/var/www/lumiere

echo ""
echo "┌─────────────────────────────────────────┐"
echo "│  LUMIÈRE Deploy → $SERVER"
echo "└─────────────────────────────────────────┘"
echo ""

# 1. Lokal bauen
echo "[1/5] npm run build..."
npm run build
echo "      ✓ Build fertig"

# 2. Build + Configs auf den Server übertragen
echo "[2/5] rsync → Server..."
rsync -az --delete \
    --exclude='.env' \
    --exclude='uploads/' \
    --exclude='*.log' \
    build/ "$SERVER:$APP_DIR/build/"

rsync -az \
    package.json \
    package-lock.json \
    drizzle.config.ts \
    "$SERVER:$APP_DIR/"

rsync -az deploy/ "$SERVER:$APP_DIR/deploy/"
echo "      ✓ Übertragen"

# 3. Deps installieren (nur wenn package.json geändert), sharp nur dann neu bauen
echo "[3/5] npm install (wenn nötig)..."
ssh "$SERVER" "
  cd $APP_DIR
  # Prüfe ob package-lock.json sich geändert hat
  if ! diff -q package-lock.json node_modules/.package-lock.json > /dev/null 2>&1; then
    echo '  → package-lock.json geändert, installiere deps...'
    npm install --omit=dev --prefer-offline --silent
    npm rebuild sharp --silent 2>/dev/null || true
  else
    echo '  → keine Änderungen, überspringe npm install'
  fi
"
echo "      ✓ Dependencies geprüft"

# 4. Schema-Sync (db:push) — .env wird auf dem Server gesourced
echo "[4/5] db:push (Schema-Sync)..."
ssh "$SERVER" "set -a && source $APP_DIR/.env && set +a && cd $APP_DIR && npx drizzle-kit push --config=$APP_DIR/drizzle.config.ts"
echo "      ✓ Schema synchronisiert"

# 5. App neu starten (zero-downtime)
echo "[5/5] PM2 reload..."
ssh "$SERVER" "pm2 reload lumiere --update-env && pm2 save"
echo "      ✓ App neu gestartet"

echo ""
echo "==> Deploy abgeschlossen!"
echo ""
ssh "$SERVER" "pm2 status"
