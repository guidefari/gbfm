import { expect, test } from '@playwright/test'

const publicRoutes = [
  '/',
  '/mixes',
  '/mixes/example-mix',
  '/shows',
  '/shows/example-show',
  '/tweets',
  '/tweet',
  '/tweet/latest',
  '/tweet/example-post',
  '/editorial',
  '/editorial/example-story',
  '/tracks/example-track',
  '/releases/example-release',
  '/labels',
  '/labels/example-label',
  '/tags',
  '/tags/house',
  '/djs',
  '/profile/example-listener',
  '/example-listener',
  '/changelog',
  '/privacy',
  '/terms',
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/subscribe',
  '/unsubscribe',
  '/invite/charlie3000',
  '/spotify/callback'
] as const

const protectedRoutes = [
  '/reminders',
  '/new',
  '/new/tweet',
  '/new/editorial',
  '/mix-upload',
  '/dashboard',
  '/dashboard/profile',
  '/dashboard/appearance',
  '/dashboard/player',
  '/dashboard/integrations',
  '/dashboard/email',
  '/dashboard/content',
  '/dashboard/content/mixes',
  '/dashboard/content/tweets',
  '/dashboard/content/editorial',
  '/dashboard/admin',
  '/dashboard/overview',
  '/dashboard/users',
  '/dashboard/sessions',
  '/dashboard/shows',
  '/dashboard/music',
  '/dashboard/music-entity/album/example-album',
  '/dashboard/playlists',
  '/dashboard/search',
  '/dashboard/newsletter',
  '/dashboard/email-logs',
  '/dashboard/frontend-errors',
  '/dashboard/all',
  '/dashboard/all/mixes',
  '/dashboard/all/tweets',
  '/dashboard/all/editorial'
] as const

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/get-session', (route) => route.fulfill({ status: 200, json: null }))
})

for (const path of publicRoutes) {
  test(`direct load: ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response?.status(), path).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText('Internal Error')
  })
}

for (const path of protectedRoutes) {
  test(`anonymous guard: ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
    expect(response?.status(), path).toBeLessThan(500)
    await expect(page).toHaveURL(/\/auth\/sign-in\?redirect=/)
  })
}

test('primary tabs complete client-side navigation without a full document reload', async ({
  page
}) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.setItem('navigation-marker', 'preserved'))

  await page.getByRole('link', { name: 'Tweets' }).click()
  await expect(page).toHaveURL(/\/tweets$/)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('navigation-marker')))
    .toBe('preserved')

  await page.getByRole('link', { name: 'Radio Shows' }).click()
  await expect(page).toHaveURL(/\/shows$/)
})

test('home SSR includes canonical metadata and visible content', async ({ page }) => {
  const response = await page.goto('/')
  expect(await response?.text()).toContain('goosebumps.fm — online community radio')
  await expect(page.getByRole('heading', { name: /goosebumps\. fm/i })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://goosebumps.fm/'
  )
})
