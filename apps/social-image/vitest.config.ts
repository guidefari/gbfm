import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.ts'],
  },
  plugins: [
    cloudflareTest({
      main: './src/worker.ts',
      miniflare: {
        compatibilityDate: '2026-07-04',
        compatibilityFlags: ['nodejs_compat'],
        modulesRules: [{ type: 'CompiledWasm', include: ['**/*.wasm'], fallthrough: true }],
        assets: {
          directory: './assets',
          binding: 'ASSETS',
          routerConfig: { invoke_user_worker_ahead_of_assets: true },
        },
      },
    }),
  ],
})
