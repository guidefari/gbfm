import { expect, test } from '@playwright/test'

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('document styles load before the client, including mobile navigation', async ({ page }) => {
    await page.goto('/mixes/e2e-local-frequencies')
    await expect(page.getByRole('navigation', { name: 'Primary', exact: true })).toHaveCSS(
      'position',
      'fixed',
    )
    await expect(
      page.getByRole('heading', { name: 'Local Frequencies', exact: true }),
    ).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
})

test('whole-document responses preserve head metadata, HEAD, redirects, and JSON navigation', async ({
  request,
}) => {
  const response = await request.get('/mixes/e2e-local-frequencies', {
    headers: { 'x-request-id': 'document-browser-fixture' },
  })
  expect(response.status()).toBe(200)
  expect(response.headers()['x-request-id']).toBe('document-browser-fixture')
  expect(response.headers()['cache-control']).toContain('no-store')
  const html = await response.text()
  expect(html.match(/rel="canonical"/g)).toHaveLength(1)
  expect(html.match(/property="og:url"/g)).toHaveLength(1)
  expect(html.match(/name="viewport"/g)).toHaveLength(1)
  expect(html).toContain('viewport-fit=cover')
  expect(html).toContain('MusicRecording')
  expect(html).toContain('data-foldkit-build=')
  const head = await request.head('/mixes/e2e-local-frequencies')
  expect(head.status()).toBe(200)
  expect(await head.body()).toHaveLength(0)
  expect(head.headers()['content-type']).toContain('text/html')
  expect(head.headers()['x-request-id']).toBeTruthy()
  const missing = await request.get('/not-a-route')
  expect(missing.status()).toBe(404)
  expect(await missing.text()).toContain('noindex, nofollow')
  const redirect = await request.get('/tweet', { maxRedirects: 0 })
  expect(redirect.status()).toBe(303)
  expect(redirect.headers().location).toBe('/tweets')
  const data = await request.get('/mixes/e2e-local-frequencies?__data=1')
  expect(data.headers()['content-type']).toContain('application/json')
  expect(await data.json()).toMatchObject({ status: 200, title: 'Local Frequencies' })
})

for (const theme of ['light', 'dark']) {
  test(`${theme} document restores the queue and adopts the existing SSR root`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((theme) => {
      localStorage.setItem('vite-ui-theme', theme)
      localStorage.setItem(
        'gbfm-audio-queue.json',
        JSON.stringify({
          currentIndex: 0,
          tracks: [
            {
              id: 'document-audio',
              title: 'Restored fixture',
              slug: 'e2e-local-frequencies',
              url: '/api/e2e-audio.wav',
              thumbnailUrl: 'https://cdn.goosebumps.fm/art.png',
              type: 'mix',
            },
          ],
        }),
      )
    }, theme)
    const gate = Promise.withResolvers<void>()
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() === 'script') await gate.promise
      await route.continue()
    })
    try {
      await page.goto('/mixes/e2e-local-frequencies', { waitUntil: 'commit' })
      const root = page.locator('.site')
      await expect(root).toHaveCount(1)
      await expect(root).toHaveAttribute('data-foldkit-build', /.+/)
      const original = await root.elementHandle()
      if (!original) throw new Error('Missing SSR root')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('html')).toHaveAttribute('data-queued', '')
      expect(
        await page.locator('html').evaluate((html) => html.style.getPropertyValue('--queued-art')),
      ).toContain('art.png?w=96&q=80&f=webp')
      gate.resolve()
      await expect(root).not.toHaveAttribute('data-foldkit-build')
      expect(await original.evaluate((node) => node.isConnected)).toBe(true)
      await expect(root).toHaveAttribute('data-interactive', 'true')
      await expect(page.locator('[data-foldkit-refused]')).toHaveCount(0)
      await page
        .getByRole('navigation', { name: 'Primary', exact: true })
        .getByRole('button', { name: 'Now playing', exact: true })
        .click()
      const player = page.getByRole('dialog', { name: 'Now playing', exact: true })
      await expect(player).toContainText('Restored fixture')
      await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
      expect(errors).toEqual([])
    } finally {
      gate.resolve()
    }
  })
}

test('keyboard search stream opens after hydration', async ({ page }) => {
  await page.goto('/mixes')
  await expect(page.locator('.site')).toHaveAttribute('data-interactive', 'true')
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Search', exact: true })).toBeVisible()
})
