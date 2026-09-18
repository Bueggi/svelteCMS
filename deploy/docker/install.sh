#!/usr/bin/env bash
# ============================================================
# LUMIÈRE — one-command installer for a fresh Linux server
# (Debian/Ubuntu; anything that runs Docker works).
#
#   curl -fsSL https://raw.githubusercontent.com/Bueggi/svelteCMS/master/deploy/docker/install.sh | sudo bash
#
# Optional environment variables:
#   DOMAIN=academy.example.com   skip the domain prompt
#   INSTALL_DIR=/opt/lumiere     where the stack lives (default)
#
# Safe to run again: existing secrets in .env are never regenerated
# (a new POSTGRES_PASSWORD would lock the app out of its own database).
# ============================================================
set -euo pipefail

REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/Bueggi/svelteCMS/master/deploy/docker}"
INSTALL_DIR="${INSTALL_DIR:-/opt/lumiere}"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }
# Random hex string of $1 bytes, without depending on openssl
rand() { head -c "$1" /dev/urandom | od -An -vtx1 | tr -d ' \n'; }

[ "$(id -u)" -eq 0 ] || die "Please run as root (e.g. with sudo)."
command -v curl >/dev/null 2>&1 || die "curl is required (apt install curl)."

# ── 1. Docker ────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker (get.docker.com)…"
    curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is missing. Install the docker-compose-plugin package and re-run."

# ── 2. Stack files ───────────────────────────────────────────
log "Downloading stack definition to $INSTALL_DIR…"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"
curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$REPO_RAW/Caddyfile" -o Caddyfile

# ── 3. .env (only on first run) ──────────────────────────────
if [ ! -f .env ]; then
    DOMAIN="${DOMAIN:-}"
    if [ -z "$DOMAIN" ]; then
        # No domain yet? <ip>.sslip.io resolves to the IP and still gets a real certificate.
        ip="$(curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
        default=""
        [ -n "$ip" ] && default="${ip//./-}.sslip.io"
        # The script may be piped into bash, so read the answer from the terminal (if there is one)
        if { exec 3</dev/tty; } 2>/dev/null; then
            read -r -u 3 -p "Domain (its DNS A record must point to this server) [${default}]: " DOMAIN || true
            exec 3<&-
        fi
        DOMAIN="${DOMAIN:-$default}"
    fi
    [ -n "$DOMAIN" ] || die "No domain given. Re-run with: DOMAIN=your.domain.tld bash install.sh"
    [[ "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die "'$DOMAIN' is not a valid host name (no https://, no path)."

    log "Generating secrets…"
    umask 077
    cat > .env <<EOF
DOMAIN=$DOMAIN
POSTGRES_PASSWORD=$(rand 24)
BETTER_AUTH_SECRET=$(rand 32)
SETUP_TOKEN=$(rand 16)
EOF
    umask 022
else
    log "Keeping existing .env"
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

# ── 4. Start ─────────────────────────────────────────────────
log "Pulling images…"
docker compose pull || die "Could not pull the images. Has the GitHub Action published ghcr.io/bueggi/sveltecms, and is the package set to public?"

log "Starting LUMIÈRE…"
docker compose up -d

log "Waiting for the app to become healthy (first start applies the database migrations)…"
healthy=""
for _ in $(seq 1 60); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$(docker compose ps -q app)" 2>/dev/null || true)"
    if [ "$status" = "healthy" ]; then healthy=1; break; fi
    sleep 3
done
[ -n "$healthy" ] || die "The app did not become healthy in time. Check: cd $INSTALL_DIR && docker compose logs app"

cat <<EOF

────────────────────────────────────────────────────────────
  LUMIÈRE is running.

  1. Make sure the DNS A record of $DOMAIN points to this server
     and ports 80 and 443 are open (also in the Hetzner firewall).
  2. Open  https://$DOMAIN/setup
  3. Setup token:  $SETUP_TOKEN
     (also stored in $INSTALL_DIR/.env)

  Update later:  cd $INSTALL_DIR && docker compose pull && docker compose up -d
  Logs:          cd $INSTALL_DIR && docker compose logs -f app
────────────────────────────────────────────────────────────
EOF
