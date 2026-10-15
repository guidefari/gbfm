import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fsModuleCache: false,
  },
  plugins: [
    cloudflareTest({
      main: './src/index.ts',
      miniflare: {
        compatibilityDate: '2026-08-08',
        r2Buckets: ['USER_CONTENT', 'MIXES'],
      },
    }),
  ],
})
