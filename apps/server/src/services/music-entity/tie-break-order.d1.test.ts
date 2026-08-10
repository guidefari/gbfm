import { Effect } from 'effect'
import { describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicAlbumsTable,
  musicArtistsTable,
  musicLabelsTable,
  musicPlaylistsTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import { db } from '@/test/d1'
import { getAlbumsEffect } from './album.service'
import { getArtistsEffect } from './artist.service'
import { getLabelsEffect } from './label.service'
import { getPlaylistsEffect } from './playlist.service'
import { getTracksEffect } from './track.service'

const run = <A>(effect: Effect.Effect<A, unknown, Database>) =>
  Effect.runPromise(effect.pipe(Effect.provideService(Database, db)) as Effect.Effect<A>)

const TIED_CREATED_AT = new Date('2025-10-07T07:35:42.727Z')
const PUBLISHED_AT = new Date('2020-01-01T00:00:00.000Z')

describe('D1 list ordering ties on createdAt', () => {
  test('getArtistsEffect breaks createdAt ties with ascending id', async () => {
    await db.insert(musicArtistsTable).values([
      { id: 'artist-c', name: 'C', slug: 'artist-c', createdAt: TIED_CREATED_AT },
      { id: 'artist-a', name: 'A', slug: 'artist-a', createdAt: TIED_CREATED_AT },
      { id: 'artist-b', name: 'B', slug: 'artist-b', createdAt: TIED_CREATED_AT }
    ])

    const artists = await run(getArtistsEffect())
    const tied = artists.filter((a) => a.id.startsWith('artist-'))
    expect(tied.map((a) => a.id)).toEqual(['artist-a', 'artist-b', 'artist-c'])
  })

  test('getAlbumsEffect breaks createdAt ties with ascending id', async () => {
    await db.insert(musicAlbumsTable).values([
      { id: 'album-c', title: 'C', slug: 'album-c', createdAt: TIED_CREATED_AT },
      { id: 'album-a', title: 'A', slug: 'album-a', createdAt: TIED_CREATED_AT },
      { id: 'album-b', title: 'B', slug: 'album-b', createdAt: TIED_CREATED_AT }
    ])

    const albums = await run(getAlbumsEffect())
    const tied = albums.filter((a) => a.id.startsWith('album-'))
    expect(tied.map((a) => a.id)).toEqual(['album-a', 'album-b', 'album-c'])
  })

  test('getTracksEffect breaks createdAt ties with ascending id', async () => {
    await db.insert(musicTracksTable).values([
      { id: 'track-c', title: 'C', slug: 'track-c', createdAt: TIED_CREATED_AT },
      { id: 'track-a', title: 'A', slug: 'track-a', createdAt: TIED_CREATED_AT },
      { id: 'track-b', title: 'B', slug: 'track-b', createdAt: TIED_CREATED_AT }
    ])

    const tracks = await run(getTracksEffect())
    const tied = tracks.filter((t) => t.id.startsWith('track-'))
    expect(tied.map((t) => t.id)).toEqual(['track-a', 'track-b', 'track-c'])
  })

  test('getPlaylistsEffect breaks createdAt ties with ascending id', async () => {
    await db.insert(musicPlaylistsTable).values([
      { id: 'playlist-c', title: 'C', slug: 'playlist-c', createdAt: TIED_CREATED_AT },
      { id: 'playlist-a', title: 'A', slug: 'playlist-a', createdAt: TIED_CREATED_AT },
      { id: 'playlist-b', title: 'B', slug: 'playlist-b', createdAt: TIED_CREATED_AT }
    ])

    const playlists = await run(getPlaylistsEffect())
    const tied = playlists.filter((p) => p.id.startsWith('playlist-'))
    expect(tied.map((p) => p.id)).toEqual(['playlist-a', 'playlist-b', 'playlist-c'])
  })

  test('getLabelsEffect breaks createdAt ties with ascending id', async () => {
    await db.insert(musicLabelsTable).values([
      {
        id: 'label-c',
        name: 'C',
        slug: 'label-c',
        createdAt: TIED_CREATED_AT,
        publishedAt: PUBLISHED_AT
      },
      {
        id: 'label-a',
        name: 'A',
        slug: 'label-a',
        createdAt: TIED_CREATED_AT,
        publishedAt: PUBLISHED_AT
      },
      {
        id: 'label-b',
        name: 'B',
        slug: 'label-b',
        createdAt: TIED_CREATED_AT,
        publishedAt: PUBLISHED_AT
      }
    ])

    const labels = await run(getLabelsEffect(true))
    const tied = labels.filter((l) => l.id.startsWith('label-'))
    expect(tied.map((l) => l.id)).toEqual(['label-a', 'label-b', 'label-c'])
  })
})
