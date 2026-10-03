import { expect, test } from '@playwright/test'

test('mobile menu contains scrolling and restores the page after dismissal and navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.goto('/privacy')
  const trigger = page.getByRole('button', { name: 'Menu', exact: true })
  const sheet = page.locator('.menu-sheet')
  const links = page.locator('.menu-sheet-links')
  await expect(trigger).toBeEnabled()
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(sheet).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .toBe('hidden')
  const bounds = await sheet.boundingBox()
  expect(bounds?.y).toBeGreaterThanOrEqual(16)
  expect((bounds?.y ?? 600) + (bounds?.height ?? 0)).toBeLessThanOrEqual(600)
  expect(await links.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await links.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(sheet.getByRole('link', { name: 'Log in', exact: true })).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(sheet).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden')
  await trigger.click()
  await expect(sheet).toBeVisible()
  await page.mouse.click(195, 8)
  await expect(page.locator('#mobile-menu')).not.toBeVisible()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden')
  await trigger.click()
  await sheet.getByRole('link', { name: 'Tweets', exact: true }).click()
  await expect(page).toHaveURL(/\/tweets$/)
  await expect(sheet).not.toBeVisible()
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden')
})
