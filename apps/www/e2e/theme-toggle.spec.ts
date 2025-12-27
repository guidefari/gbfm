import { test, expect } from '@playwright/test'

test.describe('Theme Toggle', () => {
  test('should start with dark theme by default', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('/')

    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)
  })

  test('should toggle from dark to light theme', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('/')

    const html = page.locator('html')
    await expect(html).toHaveClass(/dark/)

    const menuButton = page.getByLabel('Open menu')
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /light/i })
    await themeButton.click()

    await expect(html).toHaveClass(/light/)
    await expect(html).not.toHaveClass(/dark/)
  })

  test('should toggle from light to dark theme', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('vite-ui-theme', 'light')
    })
    await page.goto('/')

    const html = page.locator('html')
    await expect(html).toHaveClass(/light/)

    const menuButton = page.getByLabel('Open menu')
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /dark/i })
    await themeButton.click()

    await expect(html).toHaveClass(/dark/)
    await expect(html).not.toHaveClass(/light/)
  })

  test('should persist theme in localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('/')

    const menuButton = page.getByLabel('Open menu')
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /light/i })
    await themeButton.click()

    const storedTheme = await page.evaluate(() =>
      localStorage.getItem('vite-ui-theme')
    )
    expect(storedTheme).toBe('light')
  })

  test('should persist theme after page reload', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()

    const menuButton = page.getByLabel('Open menu')
    await menuButton.click()

    const themeButton = page.getByRole('button', { name: /light/i })
    await themeButton.click()

    await page.reload()

    const html = page.locator('html')
    await expect(html).toHaveClass(/light/)
  })

  test('should show correct toggle label for current theme', async ({
    page
  }) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await page.goto('/')

    const menuButton = page.getByLabel('Open menu')
    await menuButton.click()

    const lightButton = page.getByRole('button', { name: /light/i })
    await expect(lightButton).toBeVisible()

    await page.addInitScript(() => {
      window.localStorage.setItem('vite-ui-theme', 'light')
    })
    await page.goto('/')

    await menuButton.click()

    const darkButton = page.getByRole('button', { name: /dark/i })
    await expect(darkButton).toBeVisible()
  })
})
