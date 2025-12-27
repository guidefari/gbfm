import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    colorScheme: 'dark'
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'], colorScheme: 'dark' }
    }
  ],
  webServer: {
    command: 'bun dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
})
