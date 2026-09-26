import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(fileURLToPath(new URL('.', import.meta.url)), 'src'),
    },
  },
  test: {
    globals: true,
    include: ['plugins/**/*.test.ts', 'src/**/*.test.ts'],
    sequence: { concurrent: true },
    fakeTimers: { toFake: undefined },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/*.config.*', '**/vitest.setup.*'],
    },
  },
})
