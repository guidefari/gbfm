import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import { repoChangelogPlugin } from './plugins/repo-changelog'

const VPS_PROXY_TARGET = process.env.VITE_VPS_BASE_URL || 'http://127.0.0.1:3003'

const vpsProxy = {
  target: VPS_PROXY_TARGET,
  changeOrigin: true
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
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
    allowedHosts: 'all',
    proxy: {
      '/admin': vpsProxy,
      '/auth': vpsProxy,
      '/content': vpsProxy,
      '/email': vpsProxy,
      '/favorites': vpsProxy,
      '/file-manager': vpsProxy,
      '/health': vpsProxy,
      '/invite': vpsProxy,
      '/music': vpsProxy,
      '/music-reminders': vpsProxy,
      '/newsletter': vpsProxy,
      '/profile': vpsProxy,
      '/resolve': vpsProxy,
      '/rss.xml': vpsProxy,
      '/s/editorial': vpsProxy,
      '/s/label': vpsProxy,
      '/s/mix': vpsProxy,
      '/s/post': vpsProxy,
      '/s/profile': vpsProxy,
      '/s/release': vpsProxy,
      '/s/show': vpsProxy,
      '/s/track': vpsProxy,
      '/s/tweet': vpsProxy,
      '/shows': vpsProxy,
      '/sitemap.xml': vpsProxy,
      '/spotify': vpsProxy,
      '/upload': vpsProxy,
      '/user': vpsProxy
    }
  }
})
