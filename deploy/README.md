# Deployment auf Hetzner VPS (Lumière)

App-Verzeichnis: `/var/www/lumiere`
PM2-Prozessname: `lumiere`
Port: `3000`
Node-User: `lumiere`

---

## Einmalig auf dem Server einrichten

```bash
# 1. Node.js installieren (via nvm, als root oder lumiere user)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 2. pm2 global installieren
npm install -g pm2

# 3. Nginx installieren
sudo apt update && sudo apt install nginx -y

# 4. App-Verzeichnis erstellen
sudo mkdir -p /var/www/lumiere/uploads
sudo chown -R lumiere:lumiere /var/www/lumiere

# 5. Nginx-Config einrichten
sudo cp deploy/nginx.conf /etc/nginx/sites-available/lumiere
sudo ln -s /etc/nginx/sites-available/lumiere /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 6. SSL mit Let's Encrypt (Certbot)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d deine-domain.de -d www.deine-domain.de

# 7. .env anlegen (einmalig)
nano /var/www/lumiere/.env
```

---

## Wichtig: PM2 Doppelinstanz-Problem vermeiden

Es gibt **zwei PM2-Instanzen** auf dem Server, wenn systemd `pm2-lumiere.service`
(als user `lumiere`) **und** manuell `pm2 start` als `root` laufen.
Das führt zu `EADDRINUSE` (Port 3000 belegt).

**Lösung — immer nur EINEN User für PM2 nutzen (empfohlen: root oder lumiere, nicht beides):**

```bash
# Option A: PM2 komplett als root verwalten (einfachste Lösung)
# Systemd-Service des lumiere-Users deaktivieren:
sudo systemctl stop pm2-lumiere
sudo systemctl disable pm2-lumiere

# Danach als root:
pm2 start /var/www/lumiere/deploy/ecosystem.config.cjs
pm2 save
pm2 startup  # → den ausgegebenen Befehl ausführen
```

```bash
# Option B: PM2 als lumiere-User verwalten
sudo -u lumiere pm2 start /var/www/lumiere/deploy/ecosystem.config.cjs
sudo -u lumiere pm2 save
sudo -u lumiere pm2 startup systemd -u lumiere --hp /home/lumiere
# Als root: den ausgegebenen sudo-Befehl ausführen
```

---

## .env auf dem Server

```bash
nano /var/www/lumiere/.env
```

Mindest-Inhalt:
```
DATABASE_URL="postgresql://root:passwort@localhost:5432/lumiere"
BETTER_AUTH_SECRET="zufaelliger-langer-string"
BETTER_AUTH_URL="https://deine-domain.de"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
UPLOAD_DIR="/var/www/lumiere/uploads"
UPLOAD_URL_PREFIX="/uploads"
PUBLIC_BASE_URL="https://deine-domain.de"
```

> **`PUBLIC_BASE_URL` ist Pflicht** — ohne diesen Wert landen Stripe-Käufer nach der Zahlung auf `localhost`.
> Alternativ im Admin-Panel unter Einstellungen → Allgemein → Website-URL eintragen.

---

## Bei jedem Deploy

```bash
# Lokal: bauen
npm run build

# Build + package.json auf den Server übertragen
rsync -avz --delete build/ lumiere@SERVER_IP:/var/www/lumiere/build/
rsync -avz package.json lumiere@SERVER_IP:/var/www/lumiere/
rsync -avz deploy/ lumiere@SERVER_IP:/var/www/lumiere/deploy/

# Auf dem Server:
ssh lumiere@SERVER_IP
cd /var/www/lumiere
npm install --omit=dev
npm run db:push          # Schema-Änderungen anwenden
pm2 reload lumiere --update-env
```

> **Hinweis:** `npm run db:push` muss nach jedem Schema-Update ausgeführt werden.
> Vergisst man es, kann die App mit 500-Fehlern reagieren bis die Spalten existieren.

---

## Schnell-Diagnose bei 502 / 500

```bash
# App-Status prüfen
pm2 status

# Logs sehen (letzte 50 Zeilen)
pm2 logs lumiere --lines 50

# Port blockiert? → welcher Prozess hängt auf Port 3000
lsof -i :3000

# Neustart erzwingen
pm2 restart lumiere
```
