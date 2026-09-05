import { expect, test } from '@playwright/test'

const album = {
  id: 'test-album',
  title: 'Test release',
  slug: 'test-release',
  coverImageUrl: null,
  artistNames: ['Test artist']
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('gbfm-onboarding.json', JSON.stringify({ hasSeenWelcome: true }))
  )
  await page.route('**/auth/get-session*', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'test-editor',
          name: 'Test Editor',
          email: 'editor@example.test',
          role: 'admin',
          emailVerified: true
        },
        session: {
          id: 'test-session',
          userId: 'test-editor',
          expiresAt: '2099-01-01T00:00:00.000Z'
        }
      }
    })
  )
  await page.route('**/music/**', (route) => {
    const path = new URL(route.request().url()).pathname
    return route.fulfill({
      json: path.endsWith('/albums') ? [album] : path.endsWith('/test-album') ? album : []
    })
  })
})

test('Music opens an interactive picker inside the editorial workspace', async ({ page }) => {
  await page.goto('/new/editorial')
  await page.getByRole('button', { name: 'Music', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Embed music' })
  await picker.getByRole('searchbox', { name: 'Search music catalog' }).fill('Test release')
  await picker.getByRole('button', { name: /Test release Test artist/ }).click({ timeout: 5000 })
  await expect(picker).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Test release' })).toBeVisible()
})

test('sticky toolbar meets the workspace header without a gap', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/new/editorial')
  await page.locator('.cm-content').fill('Ambient listening notes.\n\n'.repeat(80))
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.locator('dialog[open]').evaluate((element) => {
    element.scrollTop = 500
  })
  await expect
    .poll(async () => {
      const header = await page.locator('dialog[open] header').boundingBox()
      const toolbar = await page.locator('.editorial-editor-topbar').boundingBox()
      if (!header || !toolbar) return null
      return toolbar.y - (header.y + header.height)
    })
    .toBe(0)
  await expect(page.locator('.editorial-editor-topbar')).toHaveCSS('border-top-width', '0px')
  await expect(page.locator('dialog[open] header')).toHaveCSS('border-bottom-width', '1px')
  await page.screenshot({
    path: testInfo.outputPath('editorial-sticky-toolbar.png'),
    animations: 'disabled'
  })
})

test('Media inserts a player without leaving the editorial workspace', async ({ page }) => {
  await page.goto('/new/editorial')
  await page.getByRole('button', { name: 'Media', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Embed external media' })
  await picker
    .getByRole('textbox', { name: 'Media URL' })
    .fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  await picker.getByRole('button', { name: 'Insert media' }).click({ timeout: 5000 })
  await expect(picker).not.toBeVisible()
  await expect(page.locator('.cm-content')).toContainText('dQw4w9WgXcQ')
})
