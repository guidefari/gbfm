import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __DEV__: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'expo-crypto': fileURLToPath(new URL('./src/test/expo-crypto.ts', import.meta.url)),
      'expo-secure-store': fileURLToPath(
        new URL('./src/test/expo-secure-store.ts', import.meta.url),
      ),
    },
  },
  test: {
    env: {
      EXPO_PUBLIC_API_URL: 'http://localhost:8787',
    },
  },
})
