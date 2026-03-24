# Deployment auf Hetzner VPS

## Einmalig auf dem Server einrichten

```bash
# 1. Node.js installieren (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 2. pm2 global installieren
npm install -g pm2

# 3. Nginx installieren
sudo apt update && sudo apt install nginx -y

# 4. App-Verzeichnis erstellen
sudo mkdir -p /var/www/myapp/uploads
sudo chown -R $USER:$USER /var/www/myapp

# 5. Nginx-Config einrichten
sudo cp deploy/nginx.conf /etc/nginx/sites-available/myapp
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 6. SSL mit Let's Encrypt (Certbot)
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d deine-domain.de -d www.deine-domain.de
```

## Bei jedem Deploy

```bash
# Lokal: bauen und hochladen
npm run build
rsync -avz --delete build/ user@deine-ip:/var/www/myapp/build/
rsync -avz package.json user@deine-ip:/var/www/myapp/
# .env manuell einmalig auf dem Server anlegen (nicht per rsync!)

# Auf dem Server:
ssh user@deine-ip
cd /var/www/myapp
npm install --omit=dev
pm2 reload ecosystem.config.cjs --update-env
# oder beim ersten Mal:
# pm2 start ecosystem.config.cjs
# pm2 save
# pm2 startup  (damit pm2 nach Reboot automatisch startet)
```

## Wichtig: .env auf dem Server

```bash
# Einmalig auf dem Server anlegen:
nano /var/www/myapp/.env
```

Inhalt (Beispiel):
```
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="https://deine-domain.de"
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
UPLOAD_DIR="/var/www/myapp/uploads"
UPLOAD_URL_PREFIX="/uploads"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
APP_NAME="Meine Academy"
```
