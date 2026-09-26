import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

import { documentTemplate } from './plugins/document-template.ts'
import { repoChangelogPlugin } from './plugins/repo-changelog.ts'
import { themeColorsPlugin } from './plugins/theme-colors.ts'

// VPS_PROXY_TARGET is deliberately not VITE_ prefixed: it steers the dev proxy
// only. Setting VITE_VPS_BASE_URL would also reach the browser bundle, making
// requests cross-site and dropping the session cookie.
const VPS_PROXY_TARGET =
  process.env.VPS_PROXY_TARGET || process.env.VITE_VPS_BASE_URL || 'http://127.0.0.1:3003'
const buildId = process.env.FOLDKIT_BUILD_ID ?? process.env.APP_RELEASE ?? randomUUID()

const vpsProxy = {
  target: VPS_PROXY_TARGET,
  changeOrigin: true,
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    documentTemplate(),
    ...foldkit({
      buildId,
      ssr: {
        serverEntry: '/src/entry.server.ts',
        build: { clientOutDir: 'dist/client', serverOutDir: 'dist/server' },
      },
    }),
    tailwindcss(),
    themeColorsPlugin(),
    repoChangelogPlugin(),
  ],
  ssr: { external: ['cloudflare:workers'] },
  build: { rolldownOptions: { external: ['cloudflare:workers'] } },
  resolve: {
    alias: {
      '@': resolve(fileURLToPath(new URL('.', import.meta.url)), 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': vpsProxy,
      '/health': vpsProxy,
      '/rss.xml': vpsProxy,
      '/sitemap.xml': vpsProxy,
      '/s/': vpsProxy,
    },
  },
})
