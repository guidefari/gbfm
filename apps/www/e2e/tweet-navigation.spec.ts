import { expect, test, type Page } from '@playwright/test'

const openReader = async (page: Page) => {
  await page.locator('summary[aria-label="Reading options"]').click()

  return page.locator('details[data-tweet-dock]')
}

const chooseTweets = async (page: Page) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Menu', exact: true })
    .getByRole('link', { name: 'Tweets', exact: true })
    .click()
}

test('the month calendar navigates the archive without triggering background keyboard shortcuts', async ({
  page,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  const reader = await openReader(page)
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await expect(reader.getByRole('link', { name: 'Jump to Feb 2020', exact: true })).toHaveAttribute(
    'href',
    '/tweet/e2e-archive-two',
  )
  await reader.getByRole('link', { name: 'Jump to Feb 2020', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  const next = await openReader(page)
  await expect(next.getByRole('link', { name: 'Jump to Feb 2020', exact: true })).toHaveAttribute(
    'aria-current',
    'date',
  )
  await next.getByRole('link', { name: 'Jump to Jan 2020', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
})

test('the reading dock and calendar remain usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/tweet/e2e-archive-one')
  const reader = await openReader(page)
  await reader.getByRole('link', { name: 'Jump to Feb 2020', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await context.close()
})

test('the collapsed reading dock never covers the end of the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tweet/e2e-music-thread')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))

  const [contentBottom, dockTop] = await page.evaluate(() => {
    const dock = document.querySelector('details[data-tweet-dock]')?.parentElement
    const replies = document.getElementById('replies')

    return [replies?.getBoundingClientRect().bottom ?? 0, dock?.getBoundingClientRect().top ?? 0]
  })

  expect(contentBottom).toBeLessThanOrEqual(dockTop)
})

test('chronological arrows stay adjacent regardless of seen history', async ({ page }) => {
  await page.goto('/tweet/e2e-archive-one')
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Skip seen' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'Newer tweet', exact: true })).toHaveAttribute(
    'href',
    '/tweet/e2e-archive-two',
  )
  await page.getByRole('link', { name: 'Newer tweet', exact: true }).focus()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await expect(page.getByRole('link', { name: 'Older tweet', exact: true })).toHaveAttribute(
    'href',
    '/tweet/e2e-archive-one',
  )
  await page.getByRole('link', { name: 'Older tweet', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Menu', exact: true })).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
})

test('legacy new-tweet URL redirects to the composer rather than looking up a tweet named new', async ({
  request,
}) => {
  const response = await request.get('/tweet/new', { maxRedirects: 0 })
  expect(response.status()).toBe(303)
  expect(response.headers().location).toBe('/new/tweet')
})

test('random unread form loads another published tweet through the local API', async ({ page }) => {
  const seen = page.waitForResponse(
    (response) =>
      response.url().endsWith('/e2e-archive-one/seen') && response.request().method() === 'POST',
  )

  await page.goto('/tweet/e2e-archive-one')
  expect((await seen).ok()).toBe(true)
  await (await openReader(page)).getByRole('button', { name: 'Random unread', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/(?!e2e-archive-one)[^?]+$/)
  await expect(
    (await openReader(page)).getByRole('link', { name: 'Latest', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('No unread tweet could be loaded. Try again.')).toHaveCount(0)
})

test('Tweets resumes the last successful visit across leaving and reload, while direct URLs and Back win', async ({
  page,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  await page.goto('/about')
  await page.reload()
  await chooseTweets(page)
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await (await openReader(page)).getByRole('link', { name: 'Latest', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/(?!latest|e2e-archive-one)[^?]+$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await page.goto('/tweet/e2e-archive-two')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  await page.goto('/tweets')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
})

test('hard Tweets entry preserves resume intent without marking latest and prefetched content is not a visit', async ({
  page,
}) => {
  await page.goto('/tweet/latest')
  const latest = new URL(page.url()).pathname

  const prefetched = page.waitForResponse((response) =>
    response.url().includes('/tweet/e2e-archive-two?__data=1'),
  )

  await page.goto('/tweet/e2e-archive-one')
  expect((await prefetched).ok()).toBe(true)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('gbfm:tweet-checkpoint')))
    .toBe('e2e-archive-one')
  const writes: Array<string> = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/seen'))
      writes.push(new URL(request.url()).pathname)
  })
  await page.goto('/tweets')
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('gbfm:tweet-checkpoint')))
    .toBe('e2e-archive-one')
  expect(writes).not.toContain(`/api/content/posts/micro/${latest.split('/').pop()}/seen`)
})

test('a deleted automatic checkpoint falls back once, but a direct missing URL stays missing', async ({
  page,
}) => {
  await page.goto('/about')
  await page.evaluate(() => sessionStorage.setItem('gbfm:tweet-checkpoint', 'e2e-deleted-tweet'))
  await page.goto('/tweets')
  await expect(page).toHaveURL(/\/tweet\/(?!latest|e2e-deleted-tweet)[^?]+$/)
  await expect(
    (await openReader(page)).getByRole('link', { name: 'Latest', exact: true }),
  ).toBeVisible()
  await page.goto('/tweet/e2e-deleted-tweet')
  await expect(page).toHaveURL(/\/tweet\/e2e-deleted-tweet$/)
  await expect(page.getByText('Tweet not found.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Latest', exact: true })).toBeVisible()
})

test('storage denial degrades to latest and independent tabs do not share checkpoints', async ({
  page,
  context,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('gbfm:tweet-checkpoint')))
    .toBe('e2e-archive-one')
  const other = await context.newPage()
  await other.goto('/tweets')
  await expect(other).toHaveURL(/\/tweet\/(?!latest|e2e-archive-one)[^?]+$/)
  await other.close()
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', {
      get() {
        throw new DOMException('Storage denied', 'SecurityError')
      },
    })
  })
  await page.goto('/tweets')
  await expect(page).toHaveURL(/\/tweet\/(?!latest|e2e-archive-one)[^?]+$/)
})

test('tweet search URLs do not resume and unread failures do not claim caught up', async ({
  page,
}) => {
  await page.goto('/tweets?q=archive')
  await expect(page).toHaveURL(/\/tweets\?q=archive$/)
  await page.route('**/api/content/posts/micro/*/neighbours', (route) =>
    route.fulfill({ status: 500, body: '{}' }),
  )
  await page.goto('/tweet/e2e-archive-one')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  const reader = await openReader(page)
  await expect(reader.getByText('Unread navigation unavailable', { exact: true })).toBeVisible()
  await expect(page.getByText('Caught up', { exact: true })).toHaveCount(0)
  await expect(reader.getByRole('button', { name: 'Retry navigation', exact: true })).toBeVisible()
})

test('Next unread goes older first, then clearly changes to newer, and reports caught up only at zero', async ({
  page,
}) => {
  await page.goto('/tweet/e2e-archive-two')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  const first = await openReader(page)
  await expect(
    first.getByRole('link', { name: 'Next unread (older)', exact: true }),
  ).toHaveAttribute('href', '/tweet/e2e-archive-one')
  await first.getByRole('link', { name: 'Next unread (older)', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  const second = await openReader(page)
  await expect(
    second.getByRole('link', { name: 'Next unread (newer)', exact: true }),
  ).toHaveAttribute('href', '/tweet/e2e-music-thread')
  await second.getByRole('link', { name: 'Next unread (newer)', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/e2e-music-thread$/)
  const last = await openReader(page)
  await expect(last.getByText('Caught up', { exact: true })).toBeVisible()
  await expect(last.getByRole('button', { name: 'Random unread', exact: true })).toBeDisabled()
})

test('starting over resets reading history and opens the latest tweet', async ({ page }) => {
  await page.goto('/tweet/e2e-archive-two')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  const reader = await openReader(page)
  await reader.getByText('Reset reading history…', { exact: true }).click()
  await reader.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/(?!latest)[^?]+$/)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(
    (await openReader(page)).getByRole('link', { name: 'Next unread (older)', exact: true }),
  ).toBeVisible()
})

test('network failure during resume preserves the checkpoint', async ({ page }) => {
  await page.goto('/tweet/e2e-archive-one')
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('gbfm:tweet-checkpoint')))
    .toBe('e2e-archive-one')
  await page.route('**/tweet/e2e-archive-one?__data=1', (route) => route.abort())
  await page.goto('/tweets')
  await expect(
    page.getByText('This page could not be loaded. Please try again.', { exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('gbfm:tweet-checkpoint'))).toBe(
    'e2e-archive-one',
  )
})

test('seen write failures are visible and retryable', async ({ page }) => {
  await page.route('**/api/content/posts/micro/*/seen', (route) =>
    route.fulfill({ status: 500, body: '{}' }),
  )
  await page.goto('/tweet/e2e-archive-one')
  await expect(
    page.getByRole('button', { name: 'Retry saving history', exact: true }),
  ).toBeVisible()
  await page.unroute('**/api/content/posts/micro/*/seen')
  await page.getByRole('button', { name: 'Retry saving history', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Retry saving history', exact: true })).toHaveCount(
    0,
  )
  await expect(
    (await openReader(page)).getByRole('link', { name: 'Next unread (newer)', exact: true }),
  ).toBeVisible()
})

test('random immediate click records the submitted tweet before leaving', async ({
  page,
  request,
}) => {
  await page.route('**/api/content/posts/micro/e2e-archive-one/seen', (route) => route.abort())
  await page.goto('/tweet/e2e-archive-one')
  await (await openReader(page)).getByRole('button', { name: 'Random unread', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/(?!e2e-archive-one)[^?]+$/)
  const cookies = await page.context().cookies()

  const response = await request.get('/api/content/posts/micro/e2e-archive-one/neighbours', {
    headers: { cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; ') },
  })

  expect((await response.json()).seen).toBe(true)
})

test('Tweets entry without JavaScript still opens latest', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  await page.goto('/tweets')
  await expect(page).toHaveURL(/\/tweet\/(?!latest)[^?]+$/)
  await expect(
    (await openReader(page)).getByRole('link', { name: 'Latest', exact: true }),
  ).toBeVisible()
  await context.close()
})

test('a modified Latest click opens a separate tab without changing the current visit', async ({
  page,
  context,
}) => {
  await page.goto('/tweet/e2e-archive-one')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()

  const [other] = await Promise.all([
    context.waitForEvent('page'),
    (await openReader(page))
      .getByRole('link', { name: 'Latest', exact: true })
      .click({ modifiers: ['Meta'] }),
  ])

  await other.waitForURL(/\/tweet\/(?!latest|e2e-archive-one)[^?]+$/)
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-one$/)
  expect(await page.evaluate(() => sessionStorage.getItem('gbfm:tweet-checkpoint'))).toBe(
    'e2e-archive-one',
  )
  await other.close()
})

test('late prefetched and loaded tweet responses cannot change a superseding page or checkpoint', async ({
  page,
}) => {
  let release = () => {}

  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  await page.route('**/tweet/e2e-archive-two?__data=1', async (route) => {
    const response = await route.fetch()
    await gate
    await route.fulfill({ response })
  })
  await page.goto('/tweet/e2e-archive-one')
  await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeEnabled()
  await page.getByRole('link', { name: 'Newer tweet', exact: true }).click()
  await expect(page).toHaveURL(/\/tweet\/e2e-archive-two$/)
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Menu', exact: true })
    .getByRole('link', { name: 'About', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()

  const late = page.waitForResponse((response) =>
    response.url().includes('/tweet/e2e-archive-two?__data=1'),
  )

  release()
  await late
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('gbfm:tweet-checkpoint'))).toBe(
    'e2e-archive-one',
  )
})
