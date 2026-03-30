module.exports = {
    apps: [
        {
            name: 'lumiere',
            // Wrapper-Skript: lädt /var/www/lumiere/.env, dann startet Node.
            // So werden Env-Vars bei JEDEM Start (inkl. Reboot) korrekt geladen.
            script: '/var/www/lumiere/deploy/start.sh',
            interpreter: '/bin/bash',
            cwd: '/var/www/lumiere',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '400M',
            // Verhindert Restart-Loops: nach einem Crash 3 Sekunden warten
            restart_delay: 3000,
            // Nach 10 Fehlstarts aufhören zu restarten (Fehler ist dauerhaft → brauchen Deploy)
            max_restarts: 10,
            // Prozess gilt als "stabil" wenn er mindestens 15 Sekunden läuft
            min_uptime: '15s',
            // Graceful-Shutdown: 8 Sekunden auf sauberes Beenden warten
            kill_timeout: 8000,
            // Fehler-Logs separat
            error_file: '/var/log/lumiere/error.log',
            out_file: '/var/log/lumiere/out.log',
            merge_logs: false,
            // Log-Rotation (PM2 logrotate Modul wird in server-setup.sh installiert)
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
};
