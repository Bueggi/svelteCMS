# LUMIÈRE — Docker-Installation

Ein Befehl auf einem frischen Linux-Server (Debian/Ubuntu, x86 oder ARM):

```bash
curl -fsSL https://raw.githubusercontent.com/Bueggi/svelteCMS/master/deploy/docker/install.sh | sudo bash
```

Der Installer

1. installiert Docker, falls es fehlt,
2. legt `/opt/lumiere` an und lädt `docker-compose.yml` + `Caddyfile`,
3. fragt nach der Domain und erzeugt `.env` mit zufälligen Secrets (Datenbank-Passwort, Auth-Secret, Setup-Token),
4. startet App, PostgreSQL und Caddy (automatisches HTTPS) und gibt am Ende die URL und das **Setup-Token** aus.

Danach `https://deine-domain/setup` öffnen, Token eingeben, Admin anlegen — fertig. Niemand muss eine `.env` anfassen.

## Vor der Installation

- **DNS:** Der A-Record der Domain muss auf die Server-IP zeigen, sonst bekommt Caddy kein Zertifikat.
  Ohne eigene Domain: `<ip-mit-bindestrichen>.sslip.io` (z. B. `203-0-113-7.sslip.io`) — der Installer schlägt das vor.
- **Ports 80 und 443** müssen offen sein (auch in der Hetzner-Cloud-Firewall).
- **Image öffentlich:** Nach dem ersten Lauf der GitHub Action (`.github/workflows/docker.yml`) das Paket
  `ghcr.io/bueggi/sveltecms` unter *Packages → Package settings* auf **Public** stellen.

## Betrieb

```bash
cd /opt/lumiere

docker compose pull && docker compose up -d     # Update (Migrationen laufen beim Start automatisch)
docker compose logs -f app                      # Logs
docker compose ps                               # Status
grep SETUP_TOKEN .env                           # Setup-Token nachlesen (nur bis das Setup abgeschlossen ist)
```

Eine feste Version statt `latest`: in `.env` `LUMIERE_VERSION=1.2.0` (bzw. ein Commit-SHA-Tag) setzen.

Zusätzliche Einstellungen (SMTP, OAuth, …) einfach als weitere Zeilen in `.env` ergänzen und mit
`docker compose up -d` übernehmen. Stripe-Keys werden im Admin-Panel gepflegt.

## Backup

```bash
# Datenbank
docker compose exec -T db pg_dump -U lumiere lumiere | gzip > lumiere-$(date +%F).sql.gz

# Uploads (Volume lumiere_uploads)
docker run --rm -v lumiere_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads-$(date +%F).tgz -C /data .
```

Die Volumes `pgdata`, `uploads`, `appdata` (Wizard-Konfiguration) und `caddy_data` (Zertifikate) überleben `docker compose down`.
**Nicht** `docker compose down -v` ausführen — das löscht Datenbank und Uploads.

## Das Update-Banner im Admin

Bei Docker-Installationen zeigt das Banner statt „Jetzt updaten" den Befehl an, der auf dem Server auszuführen ist.
Der In-App-Updater (`deploy/self-update.sh`) gehört zur PM2-Installation und funktioniert im Container nicht.
