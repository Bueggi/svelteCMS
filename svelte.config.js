import { mdsvex } from 'mdsvex';
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Build output directory
			out: 'build',
		}),
		alias: {
			$src: "src"
		}
	},
	preprocess: [vitePreprocess(), mdsvex()],
	extensions: ['.svelte', '.svx']
};

export default config;
