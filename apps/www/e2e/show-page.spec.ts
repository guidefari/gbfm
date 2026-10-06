import { expect, test } from '@playwright/test'

test('show detail renders episodes and metadata without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })

  try {
    const page = await context.newPage()
    const response = await page.goto('/shows/e2e-local-radio')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Local Radio', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Local Frequencies', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in to subscribe' })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://goosebumps.fm/shows/e2e-local-radio',
    )
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      /Local Radio/,
    )
  } finally {
    await context.close()
  }
})

test('show dial navigation preserves the document and updates metadata', async ({ page }) => {
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/shows/e2e-local-radio')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  const timeOrigin = await page.evaluate(() => performance.timeOrigin)

  const loaded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/shows/e2e-quiet-hours' &&
      new URL(response.url()).searchParams.has('__data'),
  )

  await page.getByRole('link', { name: 'Quiet Hours', exact: true }).click()
  expect((await loaded).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Quiet Hours', exact: true })).toBeVisible()
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(timeOrigin)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://goosebumps.fm/shows/e2e-quiet-hours',
  )
  await expect(page.getByRole('link', { name: 'Local Frequencies', exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('missing shows return 404 for HTML and navigation data', async ({ request }) => {
  const html = await request.get('/shows/e2e-missing-show-page')
  const data = await request.get('/shows/e2e-missing-show-page?__data=1')
  expect(html.status()).toBe(404)
  expect(data.status()).toBe(404)
  expect(await data.json()).toMatchObject({
    status: 404,
    items: [],
    shows: null,
    publicAction: null,
  })
})

test('signed-in show subscription survives a page reload', async ({ page, baseURL }) => {
  const signup = await page.request.post('/auth/sign-up/email', {
    headers: { origin: baseURL ?? 'http://127.0.0.1:5173' },
    data: {
      name: 'Show page test listener',
      email: `show-page-${crypto.randomUUID()}@gbfm.local`,
      password: 'LocalTest123!',
    },
  })

  expect(signup.ok()).toBe(true)
  await page.goto('/shows/e2e-local-radio')
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unsubscribe', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unsubscribe', exact: true })).toBeVisible()
  const data = await page.request.get('/shows/e2e-local-radio?__data=1')
  expect(data.headers()['cache-control']).toBe('private, no-store')
  expect(await data.json()).toMatchObject({
    status: 200,
    principal: { name: 'Show page test listener' },
    publicAction: { target: { kind: 'show' }, state: 'active' },
  })
})
