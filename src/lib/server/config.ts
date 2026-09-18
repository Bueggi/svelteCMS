import { env } from '$env/dynamic/private';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';

/**
 * Settings that the /setup wizard can store in a file instead of a .env file,
 * so non-technical users never have to touch environment variables.
 *
 * Priority everywhere: environment variable > config file.
 * Path: CONFIG_FILE, default `data/config.json` (relative to the working directory).
 * In Docker, mount `data/` as a volume so it survives container recreation.
 */
export interface StoredConfig {
	databaseUrl?: string;
	authSecret?: string;
}

export function getConfigPath(): string {
	return resolve(env.CONFIG_FILE || 'data/config.json');
}

let cache: StoredConfig | null = null;

function readStored(): StoredConfig {
	if (cache) return cache;
	try {
		cache = JSON.parse(readFileSync(getConfigPath(), 'utf8')) as StoredConfig;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error(`[config] Cannot read ${getConfigPath()}:`, err);
		}
		cache = {};
	}
	return cache;
}

/** Writes atomically with owner-only permissions (the file contains the DB password). */
export function saveStoredConfig(patch: StoredConfig): void {
	const next = { ...readStored(), ...patch };
	const path = getConfigPath();
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
	renameSync(tmp, path);
	cache = next;
}

export function getDatabaseUrl(): string | undefined {
	return env.DATABASE_URL?.trim() || readStored().databaseUrl || undefined;
}

export function getAuthSecret(): string | undefined {
	return env.BETTER_AUTH_SECRET?.trim() || readStored().authSecret || undefined;
}

export function isDatabaseConfigured(): boolean {
	return !!getDatabaseUrl();
}

/** True when DATABASE_URL comes from the environment — the wizard must not override it. */
export function isDatabaseFromEnv(): boolean {
	return !!env.DATABASE_URL?.trim();
}

export function generateSecret(): string {
	return randomBytes(32).toString('base64url');
}
