import { expect, test } from '@playwright/test'

test('public writing renders Markdown and trusted legacy audio without executing arbitrary markup', async ({
  page,
}) => {
  await page.route('https://w.soundcloud.com/**', (route) => route.abort())
  await page.goto('/mixes/e2e-local-frequencies')
  await expect(page.getByRole('heading', { name: 'Listening notes' })).toBeVisible()
  await expect(page.locator('.rich-content strong')).toHaveText('independent signal')
  await expect(page.getByRole('link', { name: 'Read more' })).toHaveAttribute(
    'href',
    'https://example.com/music',
  )
  await expect(page.locator('.rich-content iframe')).toHaveCount(1)
  await expect(page.locator('.rich-content iframe')).toHaveAttribute(
    'src',
    /^https:\/\/w\.soundcloud\.com\/player\//,
  )
  await expect(page.locator('.rich-content a[href^="javascript:"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Add to queue', exact: true }).click()
  await page.getByRole('button', { name: 'Open queue', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Playback queue' })).toContainText(
    'Local Frequencies',
  )
})

test('reset form preserves its token and signing out invalidates the session', async ({ page }) => {
  await page.goto('/auth/reset-password?token=local-test-token')
  await expect(page.locator('input[name="token"]')).toHaveValue('local-test-token')
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveCount(0)
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('creator@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.getByRole('link', { name: 'Player', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Continue through queue' })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Continue through queue' }).uncheck()
  await page.getByRole('button', { name: 'Save player preferences', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('gbfm-player-preferences.json')))
    .toBe('{"continueQueue":false,"restorePosition":true}')
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Continue through queue' })).not.toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Restore listening position' })).toBeChecked()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/dashboard/profile')
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible()
})
