import { defineConfig, devices } from '@playwright/test'
import type { PlaywrightTestConfig } from '@playwright/test'

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        colorScheme: 'dark',
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      },
    },
  ],
}

if (process.env.CI) config.workers = 1

if (!process.env.PLAYWRIGHT_BASE_URL) {
  config.webServer = [
    {
      command:
        'BETTER_AUTH_SECRET=local-e2e-secret-at-least-32-characters BETTER_AUTH_URL=http://127.0.0.1:3003 bun --filter @gbfm/server dev:e2e',
      url: 'http://127.0.0.1:3003/health/live',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'bunx vite --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ]
}

export default defineConfig(config)
