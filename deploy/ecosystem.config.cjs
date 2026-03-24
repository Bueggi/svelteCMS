module.exports = {
    apps: [
        {
            name: 'myapp',
            script: './build/index.js',
            cwd: '/var/www/myapp',
            instances: 1,
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                // Diese Variablen in /var/www/myapp/.env setzen:
                // DATABASE_URL, BETTER_AUTH_SECRET, STRIPE_SECRET_KEY, ...
                // UPLOAD_DIR: '/var/www/myapp/uploads',
                // UPLOAD_URL_PREFIX: '/uploads',
            },
        },
    ],
};
