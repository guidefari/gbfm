import { ArtistResponse } from '@gbfm/api/music'
import { SearchUsersResponse } from '@gbfm/api/user'
import { expect, test, type Page } from '@playwright/test'
import { Schema } from 'effect'

const signIn = async (page: Page, role: 'admin' | 'creator' | 'listener') => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(`${role}@gbfm.local`)
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('artist profile drafts are visible to admins and managers, never unrelated or anonymous visitors', async ({
  page,
}) => {
  await signIn(page, 'admin')
  const usersResponse = await page.request.get('/api/user/search?q=local-creator')
  expect(usersResponse.ok()).toBe(true)
  const users = Schema.decodeUnknownSync(SearchUsersResponse)(await usersResponse.json())
  const creator = users.find(({ username }) => username === 'local-creator')

  if (!creator) throw new Error('Missing disposable creator fixture')
  const slug = `e2e-artist-drafts-${crypto.randomUUID()}`

  const artistResponse = await page.request.post('/api/music/artists', {
    data: {
      name: 'Draft artist fixture',
      slug,
      bio: 'A disposable DJ profile.',
      publishedAt: new Date().toISOString(),
    },
  })

  expect(artistResponse.ok()).toBe(true)
  const artist = Schema.decodeUnknownSync(ArtistResponse)(await artistResponse.json())

  const created = await page.request.post('/api/content/audio', {
    data: {
      title: 'Unpublished artist mix',
      slug,
      content: '',
      url: 'https://example.test/fixture.mp3',
      type: 'mix',
      draft: true,
      creatorIds: [creator.id],
      artistIds: [artist.id],
      idempotencyKey: crypto.randomUUID(),
    },
  })

  expect(created.ok()).toBe(true)

  for (const path of [`/profile/${slug}`, `/${slug}`]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: artist.name, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Unpublished artist mix/ })).toContainText('Draft')
    await expect(page.locator('.profile-draft')).toHaveCSS('padding', '0px')
    await expect(page.locator('.profile-draft')).toHaveCSS('font-size', '9px')
    await expect(
      page.getByRole('link', { name: /Unpublished artist mix/ }).locator('img'),
    ).toBeVisible()
    await page.reload()
    await expect(page.getByRole('link', { name: /Unpublished artist mix/ })).toBeVisible()
  }

  await page.getByRole('link', { name: /Unpublished artist mix/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Unpublished artist mix', exact: true }),
  ).toBeVisible()

  await page.context().clearCookies()
  await page.goto(`/profile/${slug}`)
  await expect(page.getByText('No public content yet.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Unpublished artist mix/ })).toHaveCount(0)

  await signIn(page, 'creator')
  await page.goto(`/profile/${slug}`)
  await expect(page.getByRole('link', { name: /Unpublished artist mix/ })).toContainText('Draft')

  await page.context().clearCookies()
  await signIn(page, 'listener')
  await page.goto(`/profile/${slug}`)
  await expect(page.getByText('No public content yet.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Unpublished artist mix/ })).toHaveCount(0)
})

test('profile platform links have icons, brand hover colors and keyboard focus at desktop and mobile sizes', async ({
  page,
}) => {
  await signIn(page, 'admin')

  const platforms = [
    { platform: 'bandcamp', label: 'Bandcamp', color: 'rgb(29, 160, 195)' },
    { platform: 'substack', label: 'Substack', color: 'rgb(255, 103, 25)' },
    { platform: 'soundcloud', label: 'SoundCloud', color: 'rgb(255, 119, 0)' },
    { platform: 'instagram', label: 'Instagram', color: 'rgb(245, 96, 147)' },
    { platform: 'twitter', label: 'X / Twitter', color: 'rgb(29, 161, 242)' },
    { platform: 'tiktok', label: 'TikTok', color: 'rgb(37, 201, 208)' },
  ]

  const response = await page.request.put('/api/user/profile/social-links', {
    data: platforms.map(({ platform }, position) => ({
      platform,
      url: `https://example.test/${platform}`,
      position,
    })),
  })

  expect(response.ok()).toBe(true)

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/profile/local-admin')
    const socials = page.getByRole('navigation', { name: 'Social links' })
    await expect(socials.getByRole('link')).toHaveCount(6)

    for (const { label, color } of platforms) {
      const link = socials.getByRole('link', { name: `${label} (opens in a new tab)`, exact: true })
      await expect(link.locator('svg')).toHaveCount(2)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      await link.hover()
      await expect(link).toHaveCSS('color', color)
      await page.mouse.move(0, 0)
      await link.focus()
      await expect(link).toHaveCSS('color', color)
      await expect(link).toHaveCSS('outline-style', 'solid')
    }

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  }
})
