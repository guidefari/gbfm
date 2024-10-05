import { defineConfig } from "vite";
//import react from "@vitejs/plugin-react-swc";
import react from '@vitejs/plugin-react'
import path from "node:path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import mdx from '@mdx-js/rollup'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
    {enforce: 'pre', ...mdx({/* jsxImportSource: …, otherOptions… */})},
    react({include: /\.(jsx|js|mdx|md|tsx|ts)$/}),
    TanStackRouterVite(),
  ],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
