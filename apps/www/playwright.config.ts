import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    video: process.env.RECORD_E2E ? 'on' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    colorScheme: 'dark',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        colorScheme: 'dark',
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || undefined,
        },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: 'PORT=3003 FRONTEND_URL=http://127.0.0.1:5173 bun run --cwd ../server dev:e2e',
          url: 'http://127.0.0.1:3003/health',
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'bunx vite --host 127.0.0.1 --port 5173',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: !process.env.CI,
        },
      ],
})
