import { fileURLToPath } from 'node:url'

import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

import { repoChangelogPlugin } from './plugins/repo-changelog.ts'

export default defineConfig({
  plugins: [
    tailwindcss(),
    repoChangelogPlugin(),
    sveltekit({ tracing: { server: process.env.NODE_ENV !== 'production' } }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
