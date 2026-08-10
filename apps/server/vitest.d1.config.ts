import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.d1.test.ts']
  },
  resolve: {
    alias: {
      '@': './src'
    }
  }
})
