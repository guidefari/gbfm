import { expect, test } from '@playwright/test'

test('guest invitation preserves its public content, links and metadata without JavaScript', async ({
  browser,
  request,
}) => {
  const missing = await request.get('/invite/unknown')
  expect(missing.status()).toBe(404)
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  const response = await page.goto('/invite/charlie3000')
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle('An invitation for Charlie3000 | goosebumps.fm')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'hi Charlie! I’d love to host a guest mix from you',
  )
  await expect(page.getByText('€100 per mix', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'See kimetsu.’s page' })).toHaveAttribute(
    'href',
    '/kimetsu',
  )
  await expect(page.getByRole('link', { name: 'Meet the residents' })).toHaveAttribute(
    'href',
    '/djs',
  )
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'An invitation to contribute a guest mix to goosebumps.fm',
  )
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://goosebumps.fm/invite/charlie3000',
  )
  await context.close()
})
