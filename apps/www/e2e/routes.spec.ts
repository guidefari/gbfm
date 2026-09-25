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
  '/spotify/callback',
] as const

const protectedRoutes = [
  '/reminders',
  '/new',
  '/new/tweet',
  '/new/editorial',
  '/tweet/new',
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
  '/dashboard/all/editorial',
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
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() => sessionStorage.setItem('navigation-marker', 'preserved'))

  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Tweets' }).click()
  await expect(page).toHaveURL(/\/(?:tweets|tweet\/[^/]+)$/)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('navigation-marker')))
    .toBe('preserved')

  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Menu' })
    .getByRole('link', { name: 'Radio Shows', exact: true })
    .click()
  await expect(page).toHaveURL(/\/shows$/)
})

test('mobile menu opens and links to the newsletter subscription page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()

  const menu = page.getByRole('dialog', { name: 'Menu' })
  await expect(menu).toBeVisible()
  await menu.getByRole('link', { name: 'Newsletter' }).click()
  await expect(page).toHaveURL(/\/subscribe$/)
  await expect(page.getByRole('heading', { name: 'Stay in the loop' })).toBeVisible()
})

test('home SSR includes canonical metadata and visible content', async ({ page }) => {
  const response = await page.goto('/')
  expect(await response?.text()).toContain('goosebumps.fm — online community radio')
  await expect(page.getByRole('heading', { name: /goosebumps\. fm/i })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://goosebumps.fm/',
  )
})

test('tweet replies render hydrated music without browser-side music API requests', async ({
  page,
}) => {
  const musicRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/music/')) {
      musicRequests.push(request.url())
    }
  })

  const response = await page.goto('/tweet/e2e-music-thread')
  expect(response?.status()).toBe(200)

  const replies = page.locator('#replies')
  await expect(replies.getByRole('heading', { name: 'Reply Frequency' })).toBeVisible()
  await expect(replies.getByText('Echo Unit, Return Path')).toBeVisible()
  await expect(replies.getByRole('link', { name: /Bandcamp/ })).toHaveAttribute(
    'href',
    'https://example.bandcamp.com/track/e2e-reply',
  )
  expect(musicRequests).toEqual([])
})

test('browser telemetry batches initial, SPA, error, and player events without private data', async ({
  page,
}) => {
  const pageErrors: Array<string> = []
  const session = '29ba483e1f8842e6b8cf27df87be3556'

  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.addInitScript((sampledSession) => {
    localStorage.setItem(
      'gbfm.telemetry.session.v1',
      JSON.stringify({ id: sampledSession, createdAt: Date.now() }),
    )
    const telemetryWindow = window as typeof window & {
      __telemetryBodies: Array<string>
      __listenerTypes: Array<string>
    }
    telemetryWindow.__telemetryBodies = []
    telemetryWindow.__listenerTypes = []
    const addEventListener = window.addEventListener.bind(window)
    window.addEventListener = ((type: string, ...input: Array<unknown>) => {
      telemetryWindow.__listenerTypes.push(type)

      return Reflect.apply(addEventListener, window, [type, ...input])
    }) as typeof window.addEventListener
    Object.defineProperty(navigator, 'sendBeacon', {
      value: (_url: string, body: BodyInit | null) => {
        telemetryWindow.__telemetryBodies.push(String(body))

        return true
      },
    })
  }, session)

  await page.goto('/')
  expect(await page.evaluate(() => localStorage.getItem('gbfm.telemetry.session.v1'))).toContain(
    session,
  )
  expect(
    await page.evaluate((value) => {
      let hash = 0

      for (const character of value) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0

      return hash / 0x1_0000_0000 < 0.1
    }, session),
  ).toBe(true)
  expect(pageErrors).toEqual([])
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __listenerTypes: Array<string>
          }
        ).__listenerTypes.includes('gbfm:player-telemetry'),
      ),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Newsletter' }).click()
  await expect(page).toHaveURL(/\/subscribe$/)
  await expect(page.getByRole('heading', { name: 'Stay in the loop' })).toBeVisible()

  await page.evaluate(() => {
    window.addEventListener('error', (event) => event.preventDefault(), { once: true })
    window.dispatchEvent(
      new ErrorEvent('error', {
        error: new Error('failed person@example.com https://private.test/path/123'),
      }),
    )
    for (let index = 0; index < 20; index += 1)
      window.dispatchEvent(new CustomEvent('gbfm:player-telemetry', { detail: 'play' }))
  })
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __telemetryBodies: Array<string> }).__telemetryBodies.length,
      ),
    )
    .toBeGreaterThan(0)

  const bodies = await page.evaluate(
    () => (window as typeof window & { __telemetryBodies: Array<string> }).__telemetryBodies,
  )
  const serialized = bodies.join('\n')
  const events = bodies.flatMap((body) => JSON.parse(body).events as Array<Record<string, unknown>>)

  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'navigation', name: 'initial-load', route: '/' }),
      expect.objectContaining({
        kind: 'navigation',
        name: 'spa-navigation',
        route: '/subscribe',
      }),
      expect.objectContaining({ kind: 'ui-error', route: '/subscribe' }),
      expect.objectContaining({ kind: 'player', name: 'play', route: '/subscribe' }),
    ]),
  )
  expect(serialized).not.toContain('person@example.com')
  expect(serialized).not.toContain('private.test')
  expect(serialized).not.toMatch(/"(?:userId|email|url|query)"/)
})
