#!/bin/bash
# PM2-Einstiegspunkt — lädt .env, dann startet Node.
# Dieses Skript wird von PM2 als Prozess gestartet (interpreter: bash).
set -a
[ -f /var/www/lumiere/.env ] && source /var/www/lumiere/.env
set +a
exec node /var/www/lumiere/build/index.js
