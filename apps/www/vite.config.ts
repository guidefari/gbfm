import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { repoChangelogPlugin } from "./plugins/repo-changelog";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		tailwindcss(),
		repoChangelogPlugin(),
		{
			enforce: "pre",
			...mdx({
				/* jsxImportSource: …, otherOptions… */
			}),
		},
		react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
		tanstackRouter(),
	],
	resolve: {
		alias: {
			"@": resolve(fileURLToPath(new URL(".", import.meta.url)), "src"),
		},
	},
	server: {
		proxy: {
			'/rss.xml': {
				target: process.env.VITE_VPS_BASE_URL || 'http://127.0.0.1:3003',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/rss\.xml/, '/rss.xml')
			}
		}
	}
});
