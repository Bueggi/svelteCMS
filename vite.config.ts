import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		fs: {
			// Allow Vite to serve files from the uploads directory in dev
			allow: ['..', 'uploads'],
		},
	},
});
// Trigger reload
