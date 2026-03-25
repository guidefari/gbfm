import { test, expect } from '@playwright/test'

const MOCK_MIX_1 = {
  id: 'mix-001',
  title: 'Goosebumps Vol. 1',
  slug: 'goosebumps-vol-1',
  description: 'A test mix',
  thumbnailUrl: 'https://example.com/thumb1.jpg',
  url: 'https://example.com/mix1.mp3',
  type: 'mix',
  tags: ['house'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  creators: [{ id: 'c1', name: 'DJ Test', username: 'djtest' }],
  playCount: 0,
  draft: false,
  content: ''
}

const MOCK_MIX_2 = {
  ...MOCK_MIX_1,
  id: 'mix-002',
  title: 'Late Night Frequencies',
  slug: 'late-night-frequencies',
  thumbnailUrl: 'https://example.com/thumb2.jpg',
  url: 'https://example.com/mix2.mp3',
  creators: [
    { id: 'c2', name: 'DJ One', username: 'djone' },
    { id: 'c3', name: 'DJ Two', username: 'djtwo' }
  ]
}

test.describe('Media Session API', () => {
  test.beforeEach(async ({ page }) => {
    // Prevent real audio network requests and autoplay errors
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.load = function () {}
      HTMLMediaElement.prototype.play = function () {
        this.dispatchEvent(new Event('play'))
        return Promise.resolve()
      }
      HTMLMediaElement.prototype.pause = function () {
        this.dispatchEvent(new Event('pause'))
      }
    })

    await page.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.includes('/content/audio/mix')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [MOCK_MIX_1, MOCK_MIX_2],
            pagination: { total: 2, limit: 20, offset: 0, hasMore: false }
          })
        })
      } else if (url.endsWith('.mp3')) {
        await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' })
      } else {
        await route.continue()
      }
    })
  })

  test('sets title and artist metadata when a mix starts playing', async ({
    page
  }) => {
    await page.goto('/mixes')
    await page.waitForSelector('[data-testid="mix-item"]')

    await page.getByRole('button', { name: /^PLAY/i }).first().click()

    const metadata = await page.evaluate(() => {
      const m = navigator.mediaSession.metadata
      if (!m) return null
      return { title: m.title, artist: m.artist }
    })

    expect(metadata?.title).toBe('Goosebumps Vol. 1')
    expect(metadata?.artist).toBe('DJ Test')
  })

  test('includes artwork url in metadata', async ({ page }) => {
    await page.goto('/mixes')
    await page.waitForSelector('[data-testid="mix-item"]')

    await page.getByRole('button', { name: /^PLAY/i }).first().click()

    const artworkSrcs = await page.evaluate(() =>
      navigator.mediaSession.metadata?.artwork?.map((a) => a.src) ?? []
    )

    expect(artworkSrcs).toContain('https://example.com/thumb1.jpg')
  })

  test('joins multiple creators into artist string', async ({ page }) => {
    await page.goto('/mixes')
    await page.waitForSelector('[data-testid="mix-item"]')

    // Click the second mix (Late Night Frequencies — 2 creators)
    await page.getByRole('button', { name: /^PLAY/i }).nth(1).click()

    const artist = await page.evaluate(
      () => navigator.mediaSession.metadata?.artist
    )

    expect(artist).toBe('DJ One, DJ Two')
  })

  test('sets playbackState to playing after play', async ({ page }) => {
    await page.goto('/mixes')
    await page.waitForSelector('[data-testid="mix-item"]')

    await page.getByRole('button', { name: /^PLAY/i }).first().click()

    const state = await page.evaluate(
      () => navigator.mediaSession.playbackState
    )

    expect(state).toBe('playing')
  })

  test('sets playbackState to paused after pause', async ({ page }) => {
    await page.goto('/mixes')
    await page.waitForSelector('[data-testid="mix-item"]')

    await page.getByRole('button', { name: /^PLAY/i }).first().click()
    // Button text changes to PLAYING when active — clicking it pauses
    await page.getByRole('button', { name: /PLAYING/i }).click()

    const state = await page.evaluate(
      () => navigator.mediaSession.playbackState
    )

    expect(state).toBe('paused')
  })

  test('updates metadata when switching to a different mix', async ({
    page
  }) => {
    await page.goto('/mixes')
    await page.waitForSelector('[data-testid="mix-item"]')

    await page.getByRole('button', { name: /^PLAY/i }).first().click()
    await page.getByRole('button', { name: /^PLAY/i }).nth(1).click()

    const metadata = await page.evaluate(() => ({
      title: navigator.mediaSession.metadata?.title,
      artist: navigator.mediaSession.metadata?.artist
    }))

    expect(metadata.title).toBe('Late Night Frequencies')
    expect(metadata.artist).toBe('DJ One, DJ Two')
  })

  test('updates artwork when switching tracks', async ({ page }) => {
    await page.goto('/mixes')
    await page.waitForSelector('[data-testid="mix-item"]')

    await page.getByRole('button', { name: /^PLAY/i }).first().click()
    await page.getByRole('button', { name: /^PLAY/i }).nth(1).click()

    const artworkSrcs = await page.evaluate(
      () => navigator.mediaSession.metadata?.artwork?.map((a) => a.src) ?? []
    )

    expect(artworkSrcs).toContain('https://example.com/thumb2.jpg')
    expect(artworkSrcs).not.toContain('https://example.com/thumb1.jpg')
  })
})
