import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should start with dark theme by default', async ({ page }) => {
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
  })

  test('should toggle from dark to light theme', async ({ page }) => {
    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)

    const menuButton = page.getByRole('button', { name: /open menu/i })
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /light/i })
    await themeButton.click()

    await expect(html).toHaveClass(/light/)
    await expect(html).not.toHaveClass(/dark/)
  })

  test('should toggle from light to dark theme', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('vite-ui-theme', 'light')
    })
    await page.reload()

    const html = page.locator('html')
    await expect(html).toHaveClass(/light/)

    const menuButton = page.getByRole('button', { name: /open menu/i })
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /dark/i })
    await themeButton.click()

    await expect(html).toHaveClass(/dark/)
    await expect(html).not.toHaveClass(/light/)
  })

  test('should persist theme in localStorage', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i })
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /light/i })
    await themeButton.click()

    const storedTheme = await page.evaluate(() =>
      localStorage.getItem('vite-ui-theme')
    )
    expect(storedTheme).toBe('light')
  })

  test('should persist theme after page reload', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i })
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /light/i })
    await themeButton.click()

    await page.reload()

    const html = page.locator('html')
    await expect(html).toHaveClass(/light/)
  })

  test('should show correct icon for current theme', async ({ page }) => {
    const menuButton = page.getByRole('button', { name: /open menu/i })
    await menuButton.click()

    const sunIcon = page.locator('[data-lucide="sun"]')
    await expect(sunIcon).toBeVisible()

    const themeButton = page.getByRole('button', { name: /light/i })
    await themeButton.click()

    await menuButton.click()

    const moonIcon = page.locator('[data-lucide="moon"]')
    await expect(moonIcon).toBeVisible()
  })
})
