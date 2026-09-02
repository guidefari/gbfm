import { expect, test } from '@playwright/test'

const featuredMix = {
  id: 'mix_1',
  title: 'gb#66',
  description: '',
  thumbnailUrl: 'https://cdn.example.com/missing-cover.jpg',
  slug: 'gb66',
  content: '',
  draft: false,
  tags: [],
  type: 'mix',
  url: 'https://cdn.example.com/mix.mp3',
  showId: null,
  episodeNumber: 66,
  playCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  creators: [{ id: 'user_1', name: 'Guide Fari', username: 'guidefari' }]
}

test('home renders before session discovery', async ({ page }) => {
  await page.route('**/auth/get-session**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000))
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })
  await page.route('**/api/content/audio/mix?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [featuredMix],
        pagination: { total: 1, limit: 1, offset: 0, hasMore: false }
      })
    })
  })
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
  await page.goto(new URL('/', baseUrl).href, { waitUntil: 'domcontentloaded' })

  await expect(page.getByRole('heading', { name: /goosebumps\. fm/i })).toBeVisible({
    timeout: 1_000
  })
})
