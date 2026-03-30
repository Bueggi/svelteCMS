module.exports = {
    apps: [
        {
            name: 'lumiere',
            script: './build/index.js',
            cwd: '/var/www/lumiere',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                // Alle Secrets in /var/www/lumiere/.env pflegen — NICHT hier eintragen!
                // DATABASE_URL=postgresql://...
                // BETTER_AUTH_SECRET=...
                // BETTER_AUTH_URL=https://deine-domain.de
                // STRIPE_SECRET_KEY=sk_live_...
                // STRIPE_WEBHOOK_SECRET=whsec_...
                // UPLOAD_DIR=/var/www/lumiere/uploads
                // UPLOAD_URL_PREFIX=/uploads
                // PUBLIC_BASE_URL=https://deine-domain.de  ← Wichtig für Stripe Redirect-URLs!
            },
        },
    ],
};
