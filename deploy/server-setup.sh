#!/bin/bash
# ============================================================
# LUMIÈRE — Einmaliger Server-Setup
# Einmal ausführen: bash /var/www/lumiere/deploy/server-setup.sh
# ============================================================
set -e
APP_DIR=/var/www/lumiere

echo "==> [1/7] PM2-Doppelinstanz-Problem beheben..."
# Systemd-Service des lumiere-Users stoppen und deaktivieren
if systemctl is-active --quiet pm2-lumiere 2>/dev/null; then
    echo "  Stoppe systemd pm2-lumiere.service..."
    systemctl stop pm2-lumiere
fi
if systemctl is-enabled --quiet pm2-lumiere 2>/dev/null; then
    systemctl disable pm2-lumiere
    echo "  pm2-lumiere.service deaktiviert."
fi

# Alle laufenden PM2-Daemons (aller User) killen
echo "  Stoppe alle PM2-Prozesse..."
pm2 kill 2>/dev/null || true
# Sicherheitshalber alle node-Prozesse auf Port 3000 killen
fuser -k 3000/tcp 2>/dev/null || true
sleep 2

echo "==> [2/7] Verzeichnisse anlegen..."
mkdir -p $APP_DIR/uploads
mkdir -p /var/log/lumiere
chmod 755 /var/log/lumiere

echo "==> [3/7] .env prüfen..."
if [ ! -f $APP_DIR/.env ]; then
    echo ""
    echo "  WARNUNG: $APP_DIR/.env existiert nicht!"
    echo "  Bitte anlegen mit: nano $APP_DIR/.env"
    echo ""
    echo "  Mindest-Inhalt:"
    cat <<'ENVTEMPLATE'
DATABASE_URL="postgresql://root:PASSWORT@localhost:5432/lumiere"
BETTER_AUTH_SECRET="ZUFAELLIGER_LANGER_STRING_MIN_32_ZEICHEN"
BETTER_AUTH_URL="https://DEINE-DOMAIN.de"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
UPLOAD_DIR="/var/www/lumiere/uploads"
UPLOAD_URL_PREFIX="/uploads"
PUBLIC_BASE_URL="https://DEINE-DOMAIN.de"
UPDATE_CHECK_URL="https://raw.githubusercontent.com/Bueggi/svelteCMS/master/latest.json"
ENVTEMPLATE
    echo ""
    read -p "  .env jetzt anlegen? (enter zum Überspringen, später nachholen)" _
fi

echo "==> [4/7] Scripts ausführbar machen..."
chmod +x $APP_DIR/deploy/start.sh
chmod +x $APP_DIR/deploy/deploy.sh
chmod +x $APP_DIR/deploy/self-update.sh

echo "==> [4b/7] Git-Repo für Self-Update einrichten..."
cd $APP_DIR
if [ ! -d "$APP_DIR/.git" ]; then
    git init
    git remote add origin https://github.com/Bueggi/svelteCMS.git
    git fetch origin --depth=1
    git checkout -b master --track origin/master || git checkout master
    # .env und uploads nie durch git pull überschreiben lassen
    echo ".env" >> .gitignore
    echo "uploads/" >> .gitignore
    echo "update.log" >> .gitignore
    echo "node_modules/" >> .gitignore
    echo "build/" >> .gitignore
    echo "  ✓ Git-Repo eingerichtet (origin = GitHub)"
else
    echo "  ✓ Git-Repo bereits vorhanden"
fi

echo "==> [5/7] Globale Tools installieren (drizzle-kit für db:push)..."
npm install -g drizzle-kit tsx 2>/dev/null || true

echo "==> [6/7] PM2 Log-Rotation installieren..."
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 20M 2>/dev/null || true
pm2 set pm2-logrotate:retain 7 2>/dev/null || true

echo "==> [7a/7] App starten..."
cd $APP_DIR
pm2 start $APP_DIR/deploy/ecosystem.config.cjs
pm2 save

echo "==> [7b/7] PM2 Autostart beim Reboot einrichten..."
# Gibt einen sudo-Befehl aus, den du dann manuell ausführen musst
pm2 startup systemd -u root --hp /root
echo ""
echo "  ↑ Den obigen 'sudo env ...' Befehl jetzt ausführen!"
echo "  Danach nochmal: pm2 save"
echo ""
echo "==> Setup abgeschlossen. Status:"
pm2 status
