import { expect, test, type Page } from '@playwright/test'
import { Schema } from 'effect'

const password = 'LocalTest123!'

async function signIn(page: Page, email: string, redirect = '/dashboard') {
  await page.goto(`/auth/sign-in?redirect=${encodeURIComponent(redirect)}`)
  await page.getByLabel('Email or username').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === redirect)
}

async function publishTweet(page: Page, slug: string, title: string, body: string) {
  await page.goto('/new/tweet')
  await page.getByLabel('Title / tweet').fill(title)
  await page.getByLabel('Slug').fill(slug)
  await page.getByLabel('Body (Markdown)').fill(body)
  await page.getByLabel('Tags').fill('radio, e2e')
  await page.getByRole('button', { name: 'Review & publish' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Publish now' }).click()
  await expect(page).toHaveURL(`/tweet/${slug}`)
}

test('listener can use member settings but cannot access creator or admin tools', async ({
  page,
}) => {
  await signIn(page, 'listener@gbfm.local')
  await expect(page.getByRole('heading', { name: /Welcome back, Local/i })).toBeVisible()

  let response = await page.goto('/dashboard/profile')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Account Profile' })).toBeVisible()

  response = await page.goto('/new')
  expect(response?.status()).toBe(403)
  response = await page.goto('/dashboard/users')
  expect(response?.status()).toBe(403)
})

test('member data is present in dashboard and reminders server responses', async ({ page }) => {
  await signIn(page, 'listener@gbfm.local')

  let response = await page.goto('/dashboard')
  let html = await response?.text()
  expect(html).toContain('No favorites yet')
  expect(html).toContain('No reminders yet')
  expect(html).not.toContain('Loading favorites')
  expect(html).not.toContain('Loading reminders')

  response = await page.goto('/reminders')
  html = await response?.text()
  expect(html).toContain('No reminders yet.')
  expect(html).not.toContain('>Loading…</p>')
})

test('member settings are populated in server responses', async ({ page }) => {
  await signIn(page, 'listener@gbfm.local')

  let response = await page.goto('/dashboard/profile')
  let html = await response?.text()
  expect(html).toContain('value="local-listener"')
  expect(html).toContain('value="listener@gbfm.local"')
  expect(html).toContain(
    'reset link to <strong class="text-foreground">listener@gbfm.local</strong>',
  )
  expect(html).not.toContain('Loading social links')

  response = await page.goto('/dashboard/email')
  html = await response?.text()
  expect(html).not.toContain('Loading email preferences')
  expect(html).toContain('New Mix &amp; Show Updates')
})

test('show subscription state is present in the server-rendered response', async ({ page }) => {
  await signIn(page, 'admin@gbfm.local')
  const suffix = `${Date.now()}-${test.info().workerIndex}`
  const slug = `ssr-subscription-${suffix}`

  const createResponse = await page.context().request.post('/api/shows', {
    data: {
      title: 'SSR subscription test',
      slug,
      content: 'Server-rendered subscription state.',
      draft: false,
    },
  })

  expect(createResponse.ok()).toBe(true)

  const show = Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))(
    await createResponse.json(),
  )

  const subscribeResponse = await page.context().request.post(`/api/shows/${show.id}/subscribe`)
  expect(subscribeResponse.ok()).toBe(true)

  const browserSubscriptionRequests: Array<string> = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/user/subscriptions') {
      browserSubscriptionRequests.push(request.url())
    }
  })

  const response = await page.goto(`/shows/${slug}`)
  expect(await response?.text()).toContain('aria-label="Unsubscribe"')
  await expect(page.getByRole('button', { name: 'Unsubscribe' })).toBeVisible()
  expect(browserSubscriptionRequests).toEqual([])

  await page.getByRole('button', { name: 'Unsubscribe' }).click()
  await expect(page.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible()
})

test('creator can save and reopen a draft but cannot access admin tools', async ({ page }) => {
  await signIn(page, 'creator@gbfm.local', '/new')
  await expect(page.getByRole('heading', { name: 'New content' })).toBeVisible()

  const slug = `e2e-creator-draft-${Date.now()}`
  await page.getByLabel('Title / tweet').fill('E2E creator draft')
  await page.getByLabel('Slug').fill(slug)
  await page.getByLabel('Body (Markdown)').fill('Created by the authenticated SvelteKit E2E suite.')
  await page.getByRole('button', { name: 'Save draft' }).click()
  await expect(page.getByText('Draft saved')).toBeVisible()

  await page.goto('/dashboard/content/tweets')
  await expect(page.getByRole('heading', { name: 'Your Tweets' })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: slug })
  await expect(row).toBeVisible()
  await row.getByRole('link', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: 'Edit content' })).toBeVisible()
  await expect(page.getByLabel('Slug')).toHaveValue(slug)

  const response = await page.goto('/dashboard/users')
  expect(response?.status()).toBe(403)
})

test('tweet detail preserves the content hierarchy, navigates by link, and posts replies', async ({
  page,
  context,
}) => {
  await signIn(page, 'creator@gbfm.local', '/new')
  const suffix = `${Date.now()}-${test.info().workerIndex}`
  const firstSlug = `e2e-tweet-first-${suffix}`
  const secondSlug = `e2e-tweet-second-${suffix}`

  await publishTweet(page, firstSlug, 'First E2E transmission', 'The first transmission is live.')
  const browserNeighbourRequests: Array<string> = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/neighbours')) {
      browserNeighbourRequests.push(request.url())
    }
  })
  await publishTweet(
    page,
    secondSlug,
    'Second E2E transmission',
    'The second transmission is live.',
  )

  await expect(page.getByRole('heading', { name: 'Second E2E transmission' })).toBeVisible()
  await expect(page.getByText('The second transmission is live.')).toBeVisible()
  await expect(page.getByRole('link', { name: '#radio' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
  await expect(page.getByText('"use strict"')).toHaveCount(0)
  expect(browserNeighbourRequests).toEqual([])

  await page.getByRole('button', { name: 'Reply' }).click()
  await page.getByLabel('Write a reply').fill('E2E reply transmission')
  await page.getByRole('button', { name: 'Post reply' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Reply posted' })).toBeVisible()
  await expect(page.getByText('E2E reply transmission')).toBeVisible()

  const older = page.getByRole('link', { name: 'Older' })
  await expect(older).toBeVisible()
  await page.evaluate(() => {
    sessionStorage.setItem('tweet-navigation-marker', 'preserved')
    performance.mark('tweet-navigation-started')
  })
  await older.click()
  await expect.poll(() => new URL(page.url()).pathname).not.toBe(`/tweet/${secondSlug}`)
  await expect(page.getByRole('article').first()).toBeVisible()

  const result = await page.evaluate(() => ({
    marker: sessionStorage.getItem('tweet-navigation-marker'),
    elapsed:
      performance.now() -
      (performance.getEntriesByName('tweet-navigation-started')[0]?.startTime ?? 0),
  }))

  expect(result.marker).toBe('preserved')
  expect(result.elapsed).toBeLessThan(1_000)

  await context.clearCookies()
  await page.reload()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('editor has publishing access without administrator access', async ({ page }) => {
  await signIn(page, 'editor@gbfm.local', '/new?mode=editorial')
  await expect(page.getByRole('heading', { name: 'New content' })).toBeVisible()
  await expect(page.getByRole('combobox')).toHaveValue('post')

  let response = await page.goto('/dashboard/content/editorial')
  expect(response?.status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'Your Editorial' })).toBeVisible()

  response = await page.goto('/dashboard/overview')
  expect(response?.status()).toBe(403)
})

test('administrator can access creator and platform administration routes', async ({ page }) => {
  await signIn(page, 'admin@gbfm.local')

  const routes = [
    ['/new', 'New content'],
    ['/mix-upload', 'Upload a mix'],
    ['/dashboard/admin', 'Admin Dashboard'],
    ['/dashboard/overview', 'Admin Overview'],
    ['/dashboard/users', 'Users'],
    ['/dashboard/sessions', 'Sessions'],
    ['/dashboard/shows', 'Shows'],
    ['/dashboard/music', 'Music Catalog'],
    ['/dashboard/playlists', 'Playlist Management'],
    ['/dashboard/newsletter', 'Newsletter'],
    ['/dashboard/email-logs', 'Email Logs'],
    ['/dashboard/frontend-errors', 'Frontend Telemetry'],
    ['/dashboard/all/mixes', 'All Mixes'],
    ['/dashboard/all/tweets', 'All Tweets'],
    ['/dashboard/all/editorial', 'All Editorial'],
  ] as const

  for (const [path, heading] of routes) {
    const response = await page.goto(path)
    expect(response?.status(), path).toBe(200)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/Request failed \(\d+\)|Could not load/i)).toHaveCount(0)
  }
})

test('player preferences persist across navigation and reload', async ({ page }) => {
  await signIn(page, 'listener@gbfm.local', '/dashboard/player')
  const continueQueue = page.getByLabel('Continue through queue')
  const restorePosition = page.getByLabel('Restore listening position')
  await continueQueue.uncheck()
  await restorePosition.uncheck()
  await page.getByRole('button', { name: 'Save player settings' }).click()
  await expect(page.getByText('Player preferences saved.')).toBeVisible()

  await page.reload()
  await expect(continueQueue).not.toBeChecked()
  await expect(restorePosition).not.toBeChecked()
})
