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

test('user chooses an appearance preference and it is restored on the next visit', async ({
  page
}) => {
  await page.route('**/auth/get-session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSession)
    })
  })

  await page.goto('/dashboard/appearance')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)

  const lightButton = page.getByRole('button', { name: /light/i })
  await expect(lightButton).toBeVisible()
  await lightButton.click()

  await expect(page.locator('html')).toHaveClass(/light/)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vite-ui-theme'))).toBe('light')

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(lightButton).toHaveClass(/border-primary bg-muted/)
})
