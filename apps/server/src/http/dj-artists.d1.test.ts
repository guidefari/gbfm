import { AudioResponse, CompiledAudioResponse } from '@gbfm/api/audio'
import { PublicProfileResponse } from '@gbfm/api/profile'
import { GetShowEpisodesResponse } from '@gbfm/api/shows'
import { decodeResponseBody } from '@gbfm/api/testing'
import { ListDjsResponse } from '@gbfm/api/user'
import { expect, test } from 'vitest'

import { session, user } from '@/db/auth.schema'
import { makeDatabaseClient } from '@/db/layer'
import { musicArtistsTable } from '@/db/music-entity.schema'
import { showsTable } from '@/db/show.schema'
import { createTestWebHandler } from '@/test/http-handler'
import { createMigratedD1Database } from '@/test/migrate-d1'

test('artist credits survive HTTP encoding without exposing drafts or creating another login', async () => {
  await using resource = await createMigratedD1Database()
  const db = makeDatabaseClient(resource.database)
  const artistId = '00000000-0000-4000-8000-000000000001'
  const showId = '00000000-0000-4000-8000-000000000002'
  const token = 'fixture-admin-session'
  await db.insert(user).values({
    id: 'admin',
    name: 'Host',
    username: 'host',
    email: 'host@example.test',
    role: 'admin',
  })
  await db
    .insert(session)
    .values({ id: 'session', token, userId: 'admin', expiresAt: new Date(Date.now() + 60000) })
  await db.insert(musicArtistsTable).values({
    id: artistId,
    name: 'The Ensemble',
    slug: 'the-ensemble',
    bio: 'An alias intended to grow into a group.',
    publishedAt: new Date(),
  })
  await db.insert(showsTable).values({ id: showId, title: 'Radio', slug: 'radio', content: '' })
  const web = createTestWebHandler(resource.database)
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  try {
    const createdResponse = await web.handler(
      new Request('http://localhost/api/content/audio', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: 'TRANSMISSION 003',
          slug: 'transmission-003',
          type: 'mix',
          url: 'https://example.test/audio.mp3',
          content: '',
          draft: true,
          showId,
          episodeNumber: 3,
          creatorIds: ['admin'],
          artistIds: [artistId],
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    )

    expect(createdResponse.status).toBe(200)
    const created = await decodeResponseBody(AudioResponse, createdResponse)
    expect(created.artists).toEqual([
      { id: artistId, name: 'The Ensemble', username: 'the-ensemble' },
    ])

    const editedResponse = await web.handler(
      new Request('http://localhost/api/content/audio/mix/transmission-003/edit', { headers }),
    )

    expect(editedResponse.status).toBe(200)
    const editable = await decodeResponseBody(CompiledAudioResponse, editedResponse)
    expect(editable.creators?.map(({ id }) => id)).toEqual(['admin'])
    expect(editable.artists).toEqual(created.artists)

    const episodeResponse = await web.handler(
      new Request('http://localhost/api/shows/radio/episodes', { headers }),
    )

    expect(episodeResponse.status).toBe(200)
    const episodes = await decodeResponseBody(GetShowEpisodesResponse, episodeResponse)
    expect(episodes.data[0]?.artists).toEqual(created.artists)
    const directoryResponse = await web.handler(new Request('http://localhost/api/user/djs'))
    expect(directoryResponse.status).toBe(200)
    const directory = await decodeResponseBody(ListDjsResponse, directoryResponse)
    expect(directory).toMatchObject([{ id: artistId, name: 'The Ensemble', mixCount: 0 }])

    const profileResponse = await web.handler(
      new Request('http://localhost/api/profile/the-ensemble'),
    )

    expect(profileResponse.status).toBe(200)
    const profile = await decodeResponseBody(PublicProfileResponse, profileResponse)
    expect(profile.name).toBe('The Ensemble')
    expect(profile.content.mixes).toEqual([])

    const hiddenResponse = await web.handler(
      new Request('http://localhost/api/content/audio/mix/transmission-003'),
    )

    expect(hiddenResponse.status).toBe(404)

    const clearedResponse = await web.handler(
      new Request('http://localhost/api/content/audio/mix/transmission-003', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ artistIds: [] }),
      }),
    )

    expect(clearedResponse.status).toBe(200)
    const cleared = await decodeResponseBody(CompiledAudioResponse, clearedResponse)
    expect(cleared.artists).toEqual([])
    expect(cleared.draft).toBe(true)
    expect(cleared.creators?.map(({ id }) => id)).toEqual(['admin'])
  } finally {
    await web.dispose()
  }
}, 20000)
