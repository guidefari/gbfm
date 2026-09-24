import type { IncomingMessage } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import mdx from '@mdx-js/rollup'
import { distilledCloudflare } from '@alchemy.run/frontend-frameworks/astro/cloudflare'
import react from '@astrojs/react'
import sentry from '@sentry/astro'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { repoChangelogPlugin } from './plugins/repo-changelog'
import { themeColorsPlugin } from './plugins/theme-colors'

// VPS_PROXY_TARGET is deliberately not VITE_ prefixed: it steers the dev proxy
// only. Setting VITE_VPS_BASE_URL would also reach the browser bundle, making
// requests cross-site and dropping the session cookie.
const VPS_PROXY_TARGET =
  process.env.VPS_PROXY_TARGET || process.env.VITE_VPS_BASE_URL || 'http://127.0.0.1:3003'
const sentryRelease = process.env.SENTRY_RELEASE
const shouldUploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN && sentryRelease)
const directBuildIntegrations =
  process.env.ASTRO_DIRECT_BUILD === 'true'
    ? [distilledCloudflare({ sessions: false, sessionDevKV: false })]
    : []

const vpsProxy = {
  target: VPS_PROXY_TARGET,
  changeOrigin: true
}

const isDocumentRequest = (req: IncomingMessage) => {
  const { accept } = req.headers
  return !Array.isArray(accept) && (accept?.includes('text/html') ?? false)
}

const authProxy = {
  ...vpsProxy,
  bypass: (req: IncomingMessage) => (isDocumentRequest(req) ? req.url : undefined)
}

export default defineConfig({
  output: 'server',
  integrations: [
    ...directBuildIntegrations,
    react({ include: ['**/*.{jsx,js,mdx,md,tsx,ts}'] }),
    sentry({
      org: 'goosebumps-collective',
      project: 'gbfm-frontend',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      sourcemaps: {
        disable: !shouldUploadSourceMaps,
        filesToDeleteAfterUpload: ['./dist/**/*.map']
      },
      release: {
        name: sentryRelease,
        create: true,
        finalize: false,
        setCommits: false,
        deploy: false
      }
    })
  ],
  vite: {
    plugins: [
      tailwindcss(),
      themeColorsPlugin(),
      repoChangelogPlugin(),
      {
        enforce: 'pre',
        ...mdx()
      }
    ],
    build: {
      sourcemap: shouldUploadSourceMaps ? 'hidden' : false
    },
    optimizeDeps: {
      include: ['react-qr-code']
    },
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
  }
})
