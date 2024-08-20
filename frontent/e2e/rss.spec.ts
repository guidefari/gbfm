import { test, expect } from '@playwright/test'

test('RSS page reders correctly', async ({ page }) => {
  await page.goto('/rss.xml')
  const parserErrorElement = await page.$('parsererror')
  expect(parserErrorElement).toBeNull()
})
