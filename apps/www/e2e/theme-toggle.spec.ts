import { expect, test } from '@playwright/test'

const mockSession = {
  session: {
    token: 'session_1',
    userId: 'user_1',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  user: {
    id: 'user_1',
    email: 'test@example.com',
    name: 'Test User'
  }
}

test.describe('Theme Provider', () => {
  test('defaults to dark theme', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })

    await page.goto('/')

    await expect(page.locator('html')).toHaveClass(/dark/)
  })

  test('honors a stored light theme', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('vite-ui-theme', 'light')
    })

    await page.goto('/')

    await expect(page.locator('html')).toHaveClass(/light/)
  })

  test('toggles theme from settings', async ({ page }) => {
    await page.route('**/auth/get-session**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession)
      })
    })

    await page.addInitScript(() => {
      window.localStorage.clear()
    })

    await page.goto('/settings')

    const appearanceTab = page.getByRole('button', { name: /appearance/i })
    await expect(appearanceTab).toBeVisible()
    await appearanceTab.click()

    const lightButton = page.getByRole('button', { name: /light/i })
    await expect(lightButton).toBeVisible()
    await lightButton.click()

    await expect(page.locator('html')).toHaveClass(/light/)
    const storedTheme = await page.evaluate(() => localStorage.getItem('vite-ui-theme'))
    expect(storedTheme).toBe('light')
  })

  test('keeps the selected theme after reload', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('vite-ui-theme', 'light')
    })

    await page.goto('/')
    await page.reload()

    await expect(page.locator('html')).toHaveClass(/light/)
  })
})
