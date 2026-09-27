import { PlaylistListResponse, PlaylistTrackEntry, TrackResponse } from '@gbfm/api/music'
import { expect, test } from '@playwright/test'
import { Schema } from 'effect'

test('playlist metadata, ordering, removal and confirmed deletion persist in D1', async ({
  page,
}, testInfo) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/playlists')
  const slug = `playlist-check-${Date.now()}`
  await page.getByRole('textbox', { name: 'Playlist title', exact: true }).fill('A local playlist')
  await page.getByRole('textbox', { name: 'Playlist slug', exact: true }).fill(slug)
  await page.getByRole('button', { name: 'Create playlist', exact: true }).click()
  const listing = page.getByRole('list', { name: 'Playlists', exact: true })
  await expect(listing).toContainText(slug)
  const playlists = Schema.decodeUnknownSync(PlaylistListResponse)(
    await (await page.request.get('/api/music/playlists')).json(),
  )
  const playlist = playlists.find((item) => item.slug === slug)
  if (!playlist) throw new Error('Expected the created playlist')
  const trackIds: string[] = []
  try {
    for (const [index, title] of ['Alpha signal', 'Bravo signal', 'Charlie signal'].entries()) {
      const response = await page.request.post('/api/music/tracks', {
        data: { title, slug: `${slug}-${index}` },
      })
      expect(response.ok()).toBe(true)
      const track = Schema.decodeUnknownSync(TrackResponse)(await response.json())
      trackIds.push(track.id)
      expect(
        (
          await page.request.post(`/api/music/playlists/${playlist.id}/tracks`, {
            data: { trackId: track.id, position: index },
          })
        ).ok(),
      ).toBe(true)
    }
    await listing
      .getByRole('listitem')
      .filter({ hasText: slug })
      .getByRole('button', { name: 'Edit', exact: true })
      .click()
    const tracks = page.getByRole('list', { name: 'Playlist tracks', exact: true })
    await expect(tracks.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Move Alpha signal up' })).toBeDisabled()
    await page
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('Unsaved description survives track edits')
    const orderPath = `/api/music/playlists/${playlist.id}/tracks/order`
    await page.route(`**${orderPath}`, (route) => route.fulfill({ status: 503 }))
    await page.getByRole('button', { name: 'Move Charlie signal up' }).click()
    await expect(page.getByRole('alert')).toContainText('Playlist action failed')
    await expect(tracks.getByRole('listitem').first()).toContainText('Alpha signal')
    await expect(tracks.getByRole('listitem').nth(1)).toContainText('Bravo signal')
    await page.unroute(`**${orderPath}`)
    await page.getByRole('button', { name: 'Move Charlie signal up' }).click()
    await expect(tracks.getByRole('listitem').nth(1)).toContainText('Charlie signal')
    await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
      'Unsaved description survives track edits',
    )
    const savedTracks = Schema.decodeUnknownSync(Schema.Array(PlaylistTrackEntry))(
      await (await page.request.get(`/api/music/playlists/${playlist.id}/tracks`)).json(),
    )
    expect(savedTracks.map((row) => row.track.id)).toEqual([trackIds[0], trackIds[2], trackIds[1]])
    await page.getByRole('button', { name: 'Save playlist', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save playlist', exact: true })).toBeEnabled()
    await page.reload()
    await listing
      .getByRole('listitem')
      .filter({ hasText: slug })
      .getByRole('button', { name: 'Edit', exact: true })
      .click()
    await expect(page.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
      'Unsaved description survives track edits',
    )
    await expect(tracks.getByRole('listitem').nth(1)).toContainText('Charlie signal')
    await page.emulateMedia({ colorScheme: 'light' })
    await tracks.scrollIntoViewIfNeeded()
    await testInfo.attach('playlist-order-light', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await page.getByRole('button', { name: 'Remove Bravo signal', exact: true }).click()
    await expect(tracks.getByRole('listitem')).toHaveCount(2)
    await page.getByRole('button', { name: 'Delete playlist', exact: true }).click()
    expect((await page.request.get(`/api/music/playlists/${playlist.id}`)).status()).toBe(200)
    await page.getByRole('button', { name: 'Keep playlist', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Confirm delete playlist', exact: true }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'Delete playlist', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm delete playlist', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText('Playlist deleted.')
    expect((await page.request.get(`/api/music/playlists/${playlist.id}`)).status()).toBe(404)
    expect((await page.request.get(`/api/music/tracks/${trackIds[0]}`)).status()).toBe(200)
  } finally {
    await page.request.delete(`/api/music/playlists/${playlist.id}`)
    for (const id of trackIds) await page.request.delete(`/api/music/tracks/${id}`)
  }
})

test('Spotify playlist import and sync distinguish accepted work from failed enrichment', async ({
  page,
}) => {
  await page.goto('/auth/sign-in')
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@gbfm.local')
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('LocalTest123!')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  const slug = `import-check-${Date.now()}`
  const created = await page.request.post('/api/music/playlists', {
    data: { title: 'Imported fixture', slug },
  })
  expect(created.ok()).toBe(true)
  const playlists = Schema.decodeUnknownSync(PlaylistListResponse)(
    await (await page.request.get('/api/music/playlists')).json(),
  )
  const playlist = playlists.find((item) => item.slug === slug)
  if (!playlist) throw new Error('Expected fixture playlist')
  try {
    await page.goto('/dashboard/playlists')
    await page
      .getByRole('textbox', { name: 'Spotify playlist URL', exact: true })
      .fill('https://example.com/playlist/no')
    await page.getByRole('button', { name: 'Import playlist', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(
      'Enter an https://open.spotify.com/playlist/',
    )
    const url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
    await page.getByRole('textbox', { name: 'Spotify playlist URL', exact: true }).fill(url)
    await page.route('**/api/music/playlists/import/spotify', async (route) => {
      expect(route.request().postDataJSON()).toEqual({ url })
      await route.fulfill({
        json: {
          status: 'Imported',
          playlistId: playlist.id,
          trackCount: 7,
          createdTrackCount: 2,
          reusedTrackCount: 5,
          enrichmentStatus: 'Unavailable',
        },
      })
    })
    await page.getByRole('button', { name: 'Import playlist', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText(
      'Imported 7 tracks (2 new, 5 reused). Link enrichment unavailable; tracks were imported.',
    )
    await expect(page.getByRole('textbox', { name: 'Playlist title', exact: true })).toHaveValue(
      'Imported fixture',
    )
    const syncPath = `**/api/music/playlists/${playlist.id}/sync-links`
    await page.route(syncPath, (route) => route.fulfill({ status: 503 }))
    await page.getByRole('button', { name: 'Sync track links', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Playlist action failed')
    await expect(page.getByRole('status')).toHaveCount(0)
    await page.unroute(syncPath)
    await page.route(syncPath, (route) =>
      route.fulfill({ json: { playlistId: playlist.id, status: 'Accepted' } }),
    )
    await page.getByRole('button', { name: 'Sync track links', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText(
      'Link sync accepted for background processing.',
    )
    const trackUrl = 'https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh'
    await page.getByRole('textbox', { name: 'Spotify track URL', exact: true }).fill(trackUrl)
    await page.route(`**/api/music/playlists/${playlist.id}/tracks/spotify`, async (route) => {
      expect(route.request().postDataJSON()).toEqual({ url: trackUrl })
      await route.fulfill({ status: 503 })
    })
    await page.getByRole('button', { name: 'Add Spotify track', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Playlist action failed')
    await expect(page.getByRole('textbox', { name: 'Spotify track URL', exact: true })).toHaveValue(
      trackUrl,
    )
  } finally {
    await page.request.delete(`/api/music/playlists/${playlist.id}`)
  }
})
