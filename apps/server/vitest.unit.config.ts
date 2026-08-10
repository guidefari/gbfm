/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.d1.test.ts', 'src/**/*.integration.test.ts']
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
