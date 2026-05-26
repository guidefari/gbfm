/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/lib/**/*.test.ts', 'src/services/**/*.unit.test.ts']
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
