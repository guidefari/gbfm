import { expect, test } from '@playwright/test'

test('primary tweet and structured metadata are rendered before replies', async ({ request }) => {
  const response = await request.get('/tweet/e2e-music-thread')
  expect(response.status()).toBe(200)
  const html = await response.text()
  expect(html).toContain('A tweet with a musical reply.')
  expect(html).toContain('Root Frequency')
  expect(html).not.toContain('Reply Frequency')
  expect(html).toContain('Loading replies')
  expect(html).toContain('application/ld+json')
  expect(html).toContain('datePublished')
  expect(html).toContain('rel="canonical"')
  expect(response.headers()['x-request-id']).toBeTruthy()
})

test('anonymous public navigation hydrates and missing pages return real 404s', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/tweet/e2e-music-thread')
  await expect(page.getByRole('heading', { name: 'Root Frequency' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Reply Frequency' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'bandcamp' })).toHaveAttribute(
    'href',
    'https://example.bandcamp.com/track/e2e-reply',
  )
  await page.getByRole('checkbox', { name: 'Skip seen' }).check()
  await expect(page.getByRole('checkbox', { name: 'Skip seen' })).toBeChecked()
  const response = await page.goto('/not-a-route')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  expect(errors).toEqual([])
})

test('failed replies never masquerade as an empty thread', async ({ page }) => {
  await page.route('**/screen/replies', (route) => route.fulfill({ status: 503 }))
  await page.goto('/tweet/e2e-music-thread')
  await expect(page.getByRole('heading', { name: 'Root Frequency' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Replies are unavailable')
  await expect(page.getByText('No replies yet.')).toHaveCount(0)
})

test('creator profile persists and private SSR avoids a duplicate browser account request', async ({
  page,
}) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('creator@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)

  const accountRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/user/profile')
      accountRequests.push(request.method())
  })
  await page.goto('/dashboard/profile')
  await expect(page.getByRole('textbox', { name: 'Username' })).toHaveValue('local-creator')
  await expect(page.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  expect(accountRequests).toEqual([])

  const bio = 'Independent frequencies, tested against local D1.'
  await page.getByRole('textbox', { name: 'Bio' }).fill(bio)
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/user/profile') && response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'Save profile' }).click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Bio' })).toHaveValue(bio)

  const response = await page.request.get('/dashboard/profile')
  expect(response.headers()['cache-control']).toContain('no-store')
  expect(await response.text()).toContain(bio)
  await expect(page.getByRole('navigation', { name: 'Dashboard', exact: true })).not.toContainText(
    'Users',
  )
  await page.goto('/dashboard/users')
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
})

test('auth forms reject a cross-origin submission', async ({ request }) => {
  const response = await request.post('/auth/sign-in', {
    headers: { origin: 'https://attacker.invalid' },
    form: { email: 'creator@gbfm.local', password: 'LocalTest123!' },
  })
  expect(response.status()).toBe(403)
  expect(response.headers()['set-cookie']).toBeUndefined()
})

test('playback advances and persists through client navigation', async ({ page }) => {
  await page.goto('/mixes')
  await page
    .getByRole('article')
    .filter({ hasText: 'Local Frequencies' })
    .getByRole('button', { name: 'Play', exact: true })
    .click()
  const player = page.getByRole('region', { name: 'Audio player' })
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole('region', { name: 'Now playing' })
          .getByRole('slider', { name: 'Playback position' })
          .inputValue(),
      ),
    )
    .toBeGreaterThan(0.5)
  await page.getByRole('button', { name: 'Collapse player', exact: true }).click()
  await page.getByRole('link', { name: 'Privacy', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await player.getByRole('button', { name: 'Open queue', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Playback queue' })).toContainText(
    'Local Frequencies',
  )
  await page.getByRole('button', { name: 'Close queue', exact: true }).click()
  await player.getByRole('button', { name: 'Pause', exact: true }).click()
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('creator restores an autosaved draft, publishes it, and reads its public SSR page', async ({
  page,
}) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('creator@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/new/tweet')
  const slug = `e2e-published-${Date.now()}`
  await page
    .getByRole('textbox', { name: 'Writing canvas' })
    .fill('An independent signal from the Foldkit composer.')
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Writing canvas' })).toHaveValue(
    'An independent signal from the Foldkit composer.',
  )
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Published.')
  await page.getByRole('link', { name: 'View published content' }).click()
  await expect(page).toHaveURL(new RegExp(`/tweet/${slug}$`))
  const response = await page.request.get(`/tweet/${slug}`)
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('An independent signal from the Foldkit composer.')
})
