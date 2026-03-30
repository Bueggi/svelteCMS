# Lumière — Deployment

## Sofortfix bei aktuellem 502

SSH auf den Server und diese Befehle ausführen:

```bash
# 1. Alle PM2-Instanzen killen (löst den Doppelinstanz-Konflikt)
pm2 kill
fuser -k 3000/tcp 2>/dev/null || true

# 2. Setup-Skript ausführen (einmalig — richtet alles sauber ein)
cd /var/www/lumiere
git pull
bash deploy/server-setup.sh
```

Das Skript:
- Deaktiviert den systemd `pm2-lumiere.service` (der als `lumiere`-User läuft)
- Killt alle PM2-Daemons
- Startet PM2 sauber als `root`
- Richtet Autostart beim Reboot ein
- Installiert Log-Rotation

---

## Einmaliger Server-Setup (frische Installation)

```bash
# 1. Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20
nvm alias default 20

# 2. PM2 + Nginx
npm install -g pm2
sudo apt update && sudo apt install nginx -y

# 3. Verzeichnis
mkdir -p /var/www/lumiere/uploads

# 4. Code deployen (von lokal)
bash deploy/deploy.sh root@DEINE-IP

# 5. .env anlegen (auf dem Server)
nano /var/www/lumiere/.env   # siehe Vorlage unten

# 6. Setup-Skript ausführen
bash /var/www/lumiere/deploy/server-setup.sh
# → den ausgegebenen "sudo env ..." Befehl kopieren und ausführen!
# → danach: pm2 save

# 7. Nginx einrichten
sudo cp /var/www/lumiere/deploy/nginx.conf /etc/nginx/sites-available/lumiere
sudo ln -s /etc/nginx/sites-available/lumiere /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 8. SSL (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d deine-domain.de -d www.deine-domain.de
```

---

## .env Vorlage

```
# /var/www/lumiere/.env
DATABASE_URL="postgresql://root:PASSWORT@localhost:5432/lumiere"
BETTER_AUTH_SECRET="ZUFAELLIGER_STRING_MIN_32_ZEICHEN"
BETTER_AUTH_URL="https://deine-domain.de"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
UPLOAD_DIR="/var/www/lumiere/uploads"
UPLOAD_URL_PREFIX="/uploads"
PUBLIC_BASE_URL="https://deine-domain.de"
```

> **`PUBLIC_BASE_URL` ist Pflicht.** Ohne diesen Wert landet der Käufer nach
> der Stripe-Zahlung auf `localhost:5173`. Alternativ im Admin-Panel unter
> Einstellungen → Allgemein → Website-URL eintragen.

---

## Jeden Deploy ausführen (von lokal)

```bash
bash deploy/deploy.sh root@DEINE-IP
```

Das Skript macht automatisch:
1. `npm run build`
2. `rsync` build + deploy-Dateien auf den Server
3. `npm install --omit=dev`
4. `npm run db:push` (Schema-Sync — verhindert 500er nach Schema-Änderungen)
5. `pm2 reload lumiere --update-env` (zero-downtime restart)

---

## Diagnose bei Problemen

```bash
# App-Status
pm2 status

# Live-Logs
pm2 logs lumiere

# Fehler-Log
tail -100 /var/log/lumiere/error.log

# Welcher Prozess hängt auf Port 3000?
lsof -i :3000

# Nginx-Fehler
sudo tail -50 /var/log/nginx/error.log

# App manuell neu starten
pm2 restart lumiere --update-env
```

---

## Warum war es instabil?

| Problem | Ursache | Fix |
|---|---|---|
| `EADDRINUSE :3000` | PM2 lief als `lumiere`-User (systemd) UND als `root` gleichzeitig | `server-setup.sh` deaktiviert systemd-Service, nur noch 1 PM2-Instanz |
| 500 nach Deploy | Schema-Änderungen ohne `db:push` | `deploy.sh` führt immer `db:push` aus |
| 502 nach Reboot | PM2 startete ohne `.env` → Datenbankfehler → Crash | `start.sh` lädt `.env` vor Node-Start |
| Endlos-Restartloop | App crashed sofort → PM2 restartete 100x/Minute | `max_restarts: 10`, `restart_delay: 3s` |
