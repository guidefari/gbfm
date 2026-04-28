import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		tailwindcss(),
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
			"@": resolve(__dirname, "./src"),
		},
	},
	server: {
		proxy: {
			'/rss.xml': {
				target: process.env.VITE_VPS_BASE_URL || 'http://localhost:3003',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/rss\.xml/, '/rss.xml')
			}
		}
	}
});
