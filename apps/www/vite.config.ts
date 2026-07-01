import type { IncomingMessage } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { repoChangelogPlugin } from './plugins/repo-changelog'
import { themeColorsPlugin } from './plugins/theme-colors'

const VPS_PROXY_TARGET = process.env.VITE_VPS_BASE_URL || 'http://127.0.0.1:3003'

const vpsProxy = {
  target: VPS_PROXY_TARGET,
  changeOrigin: true
}

const isDocumentRequest = (req: IncomingMessage) =>
  typeof req.headers.accept === 'string' && req.headers.accept.includes('text/html')

const authProxy = {
  ...vpsProxy,
  bypass: (req: IncomingMessage) => (isDocumentRequest(req) ? '/index.html' : undefined)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    themeColorsPlugin(),
    repoChangelogPlugin(),
    {
      enforce: 'pre',
      ...mdx({
        /* jsxImportSource: …, otherOptions… */
      })
    },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tanstackRouter()
  ],
  resolve: {
    alias: {
      '@': resolve(fileURLToPath(new URL('.', import.meta.url)), 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': vpsProxy,
      '/auth': authProxy,
      '/health': vpsProxy,
      '/rss.xml': vpsProxy,
      '/sitemap.xml': vpsProxy,
      '/s/': vpsProxy
    }
  }
})
