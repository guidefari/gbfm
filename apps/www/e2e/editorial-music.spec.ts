import { compile } from '@mdx-js/mdx'
import { expect, test, type Page } from '@playwright/test'

const albumUrl = 'https://open.spotify.com/album/1234567890123456789012'
const playlistUrl = 'https://open.spotify.com/playlist/1234567890123456789012'
const trackUrl = 'https://open.spotify.com/track/1234567890123456789012'
const album = {
  id: 'test-album',
  title: 'Test release',
  slug: 'test-release',
  coverImageUrl: null,
  artistNames: ['Test artist'],
  description: null
}
const tracks = [
  { title: 'Opening track', artists: 'Test artist', trackUrl, previewUrl: null },
  { title: 'Closing track', artists: 'Guest artist', trackUrl }
]

async function connectSpotify(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'spotify-effect:tokens',
      JSON.stringify({
        accessToken: 'fake-token',
        refreshToken: 'fake-refresh',
        accessTokenExpiresAt: 4102444800000
      })
    )
  )
  await page.route('https://api.spotify.com/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/v1/me')
      return route.fulfill({
        json: {
          id: 'test-listener',
          display_name: 'Test listener',
          external_urls: {},
          followers: { href: null, total: 0 },
          href: 'https://api.spotify.com/v1/me',
          images: [],
          type: 'user',
          uri: 'spotify:user:test-listener'
        }
      })
    if (path === '/v1/me/player/devices')
      return route.fulfill({
        json: {
          devices: [
            {
              id: 'test-device',
              is_active: true,
              is_private_session: false,
              is_restricted: false,
              name: 'Test speaker',
              type: 'Computer',
              volume_percent: 50
            }
          ]
        }
      })
    if (path === '/v1/me/player/play' || path === '/v1/me/player/queue')
      return route.fulfill({ status: 204 })
    return route.fulfill({ status: 500, json: {} })
  })
}

async function openEditorial(page: Page, content: string) {
  const compiledContent = String(await compile(content, { outputFormat: 'function-body' }))
  await page.route('**/content/posts/editorials/test-story', (route) =>
    route.fulfill({
      json: {
        id: 'test-story',
        title: 'Test story',
        description: null,
        thumbnailUrl: null,
        slug: 'test-story',
        content,
        compiledContent,
        draft: false,
        tags: [],
        type: 'post',
        musicEntityType: null,
        musicEntityId: null,
        parentPostId: null,
        rootPostId: null,
        depth: 0,
        quotedPostId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        creators: []
      }
    })
  )
  await page.goto('/editorial/test-story')
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('gbfm-onboarding.json', JSON.stringify({ hasSeenWelcome: true }))
  )
  await page.route('**/auth/get-session*', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'test-editor',
          name: 'Test Editor',
          email: 'editor@example.test',
          role: 'admin',
          emailVerified: true
        },
        session: {
          id: 'test-session',
          userId: 'test-editor',
          expiresAt: '2099-01-01T00:00:00.000Z'
        }
      }
    })
  )
  await page.route('**/music/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/links'))
      return route.fulfill({
        json: [
          {
            id: 'spotify-link',
            platform: 'spotify',
            status: 'verified',
            url: path.includes('/playlist/') ? playlistUrl : albumUrl
          }
        ]
      })
    return route.fulfill({
      json: path.endsWith('/albums')
        ? [album]
        : path.endsWith('/test-album') || path.endsWith('/test-playlist')
          ? album
          : []
    })
  })
  await page.route('**/spotify/album', (route) => {
    if (route.request().postDataJSON().id !== '1234567890123456789012') {
      return route.fulfill({ status: 400, json: { _tag: 'BadRequest' } })
    }
    return route.fulfill({
      json: { albumType: 'album', title: album.title, artists: 'Test artist', tracks, albumUrl }
    })
  })
  await page.route('**/spotify/playlist', (route) => {
    if (route.request().postDataJSON().id !== '1234567890123456789012') {
      return route.fulfill({ status: 400, json: { _tag: 'BadRequest' } })
    }
    return route.fulfill({ json: { title: 'Test playlist', tracks, playlistUrl } })
  })
  await page.route('**/api/music-reminders**', (route) => route.fulfill({ json: {} }))
})

test('composer Music picker opens above the workspace and inserts a release', async ({ page }) => {
  await page.goto('/new/editorial')
  await page.getByRole('button', { name: 'Music', exact: true }).click()
  const search = page.getByRole('searchbox', { name: 'Search music catalog' })
  await search.fill('Test release', { timeout: 5000 })
  await page.getByRole('button', { name: /Test release Test artist/ }).click({ timeout: 5000 })
  await expect(page.getByRole('heading', { name: 'Test release' })).toBeVisible()
  await expect(search).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Opening track' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remind me' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(
    page.locator('.editorial-editor-preview').getByRole('link', { name: 'Opening track' })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remind me' })).toHaveCount(0)
})

test('composer Media picker accepts a URL and inserts media', async ({ page }) => {
  await page.goto('/new/editorial')
  await page.getByRole('button', { name: 'Media', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Media URL' })
    .fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { timeout: 5000 })
  await page.getByRole('button', { name: 'Insert media' }).click({ timeout: 5000 })
  await expect(page.locator('.cm-content')).toContainText('dQw4w9WgXcQ')
})

for (const type of ['album', 'playlist']) {
  test(`${type} embed shows ordered tracks and the reminder dialog`, async ({ page }) => {
    await openEditorial(page, `<MusicEntity type="${type}" id="test-${type}" />`)
    const list = page.getByRole('region', { name: 'Track list' })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list.getByRole('listitem').first()).toContainText('Opening track')
    await expect(list.getByRole('listitem').last()).toContainText('Closing track')
    await page.getByRole('button', { name: 'Remind me' }).click()
    await expect(page.getByRole('dialog', { name: 'Set a listen reminder' })).toBeVisible()
    await page.getByLabel('Remind me on').fill('2099-01-01T12:00')
    const request = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/music-reminders')
    )
    await page.getByRole('button', { name: 'Set reminder', exact: true }).click()
    expect((await request).postDataJSON()).toMatchObject({
      musicTitle: album.title,
      musicUrl: type === 'album' ? albumUrl : playlistUrl
    })
  })
}

test('display props disable tracks and reminders without fetching tracks', async ({ page }) => {
  await connectSpotify(page)
  const trackRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/spotify/')) trackRequests.push(request.url())
  })
  await openEditorial(
    page,
    '<MusicEntity type="album" id="test-album" showTracks={false} showPlaybackControls={false} showReminder={false} />'
  )
  await expect(page.getByRole('heading', { name: 'Test release' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Spotify', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Track list' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remind me' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /on Spotify|Spotify queue/ })).toHaveCount(0)
  expect(trackRequests).toEqual([])
})

for (const type of ['album', 'playlist']) {
  test(`${type} without Spotify shows catalog tracks in release order`, async ({ page }) => {
    const catalogTracks = [2, 1].map((trackNumber) => ({
      id: `track-${trackNumber}`,
      title: `Catalog track ${trackNumber}`,
      artistNames: ['Test artist'],
      coverImageUrl: null,
      albumId: 'test-album',
      trackNumber,
      slug: `track-${trackNumber}`,
      publishedAt: null,
      createdById: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01'
    }))
    await page.route('**/music/*/*/links*', (route) => route.fulfill({ json: [] }))
    await page.route('**/music/tracks', (route) => route.fulfill({ json: catalogTracks }))
    await page.route('**/music/playlists/test-playlist/tracks', (route) =>
      route.fulfill({
        json: catalogTracks.map((track) => ({
          track,
          position: track.trackNumber,
          addedAt: '2026-01-01',
          links: []
        }))
      })
    )
    await openEditorial(page, `<MusicEntity type="${type}" id="test-${type}" />`)
    const list = page.getByRole('region', { name: 'Track list' })
    await expect(list.getByRole('listitem')).toHaveCount(2)
    await expect(list.getByRole('listitem').first()).toContainText('Catalog track 1')
    await expect(list.getByRole('listitem').last()).toContainText('Catalog track 2')
    await expect(page.getByRole('button', { name: 'Remind me' })).toHaveCount(0)
  })
}

test('Spotify controls play the release and queue an individual track', async ({ page }) => {
  await connectSpotify(page)
  await openEditorial(page, '<MusicEntity type="album" id="test-album" />')
  const playRequest = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().includes('/me/player/play')
  )
  await page.getByRole('button', { name: 'Play album on Spotify', exact: true }).click()
  expect((await playRequest).postDataJSON()).toEqual({
    context_uri: 'spotify:album:1234567890123456789012'
  })
  const queueRequest = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().includes('/me/player/queue')
  )
  await page
    .getByRole('button', { name: 'Add track to Spotify queue', exact: true })
    .first()
    .click()
  expect(new URL((await queueRequest).url()).searchParams.get('uri')).toBe(
    'spotify:track:1234567890123456789012'
  )
})

test('music embeds fit a narrow screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openEditorial(page, '<MusicEntity type="album" id="test-album" />')
  await expect(page.getByRole('region', { name: 'Track list' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: testInfo.outputPath('music-embed-mobile.png'),
    fullPage: true,
    animations: 'disabled'
  })
})

test('track-list failure stays hidden while metadata and stream links remain', async ({ page }) => {
  await page.route('**/spotify/album', (route) => route.fulfill({ status: 500, json: {} }))
  const fallback = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/music/tracks'
  )
  await openEditorial(page, '<MusicEntity type="album" id="test-album" />')
  await fallback
  await expect(page.getByText('Loading tracks…')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Track list' })).toHaveCount(0)
  await expect(page.getByText(/Track list is unavailable|No tracks available/)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Test release' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Spotify', exact: true })).toBeVisible()
})
