import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'child_process';

function getGitCommit(): string {
	try {
		return execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return 'unknown';
	}
}

export default defineConfig({
	define: {
		__GIT_COMMIT__: JSON.stringify(getGitCommit()),
	},
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		fs: {
			// Allow Vite to serve files from the uploads directory in dev
			allow: ['..', 'uploads'],
		},
	},
});
// Trigger reload
