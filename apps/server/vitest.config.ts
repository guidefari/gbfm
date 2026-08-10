/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    hookTimeout: 120_000,
    pool: 'forks'
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
