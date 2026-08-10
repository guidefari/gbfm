import { and, eq, inArray } from 'drizzle-orm'
import { Cause, Effect, Exit, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicEntityTypesTable,
  musicPlaylistsTable,
  musicPlatformsTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import type { SpotifyImportPlaylist, SpotifyImportTrack } from '@/services/spotify.service'
import { db } from '@/test/d1'
import {
  SpotifyImportResolver,
  SpotifyImportResolverLocalLayer
} from './spotify-import-resolver.service'

const CONCURRENCY = 20

const TestSpotifyImportResolverLayer = SpotifyImportResolverLocalLayer.pipe(
  Layer.provide(Layer.succeed(Database)(db))
)

const getTestResolver = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* SpotifyImportResolver
    }).pipe(Effect.provide(TestSpotifyImportResolverLayer))
  )

const spotifyTrack = {
  spotifyTrackId: 'spotify-concurrent-track',
  title: 'Concurrent Spotify Track',
  artistNames: ['Concurrent Artist'],
  artistSpotifyIds: ['spotify-concurrent-artist'],
  albumName: 'Concurrent Album',
  albumSpotifyId: 'spotify-concurrent-album',
  albumImageUrl: null,
  trackUrl: 'https://open.spotify.com/track/spotify-concurrent-track',
  previewUrl: null,
  durationMs: 120_000,
  trackNumber: 1
} satisfies SpotifyImportTrack

const spotifyPlaylist = {
  spotifyPlaylistId: 'spotify-concurrent-playlist',
  title: 'Concurrent Spotify Playlist',
  description: null,
  coverImageUrl: null,
  ownerName: 'Concurrent Owner',
  playlistUrl: 'https://open.spotify.com/playlist/spotify-concurrent-playlist',
  tracks: []
} satisfies SpotifyImportPlaylist

beforeAll(async () => {
  await db.insert(musicEntityTypesTable).values([
    { id: 'track', displayName: 'Track' },
    { id: 'playlist', displayName: 'Playlist' }
  ])
  await db.insert(musicPlatformsTable).values({ id: 'spotify', displayName: 'Spotify' })
})

describe('D1 concurrent Spotify import resolution', () => {
  test('20 concurrent track resolutions for one Spotify URL create exactly one track', async () => {
    const resolver = await getTestResolver()
    const exits = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        Effect.runPromiseExit(resolver.resolveTrack(spotifyTrack))
      )
    )

    const succeeded = exits.filter(Exit.isSuccess)
    const failed = exits.filter(Exit.isFailure)

    for (const exit of failed) {
      expect(Cause.hasDies(exit.cause)).toBe(false)
    }

    expect(failed).toHaveLength(0)
    expect(succeeded).toHaveLength(CONCURRENCY)
    expect(succeeded.filter((exit) => exit.value.created)).toHaveLength(1)

    const trackIds = [...new Set(succeeded.map((exit) => exit.value.trackId))]
    expect(trackIds).toHaveLength(1)

    const links = await db
      .select()
      .from(musicEntityLinksTable)
      .where(
        and(
          eq(musicEntityLinksTable.entityType, 'track'),
          eq(musicEntityLinksTable.platform, 'spotify'),
          eq(musicEntityLinksTable.url, spotifyTrack.trackUrl)
        )
      )
    const tracks = await db
      .select()
      .from(musicTracksTable)
      .where(inArray(musicTracksTable.id, trackIds))

    expect(links).toHaveLength(1)
    expect(tracks).toHaveLength(1)
  })

  test('20 concurrent playlist resolutions for one Spotify URL create exactly one playlist', async () => {
    const resolver = await getTestResolver()
    const exits = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        Effect.runPromiseExit(resolver.resolvePlaylist(spotifyPlaylist, null, null))
      )
    )

    const succeeded = exits.filter(Exit.isSuccess)
    const failed = exits.filter(Exit.isFailure)

    for (const exit of failed) {
      expect(Cause.hasDies(exit.cause)).toBe(false)
    }

    expect(failed).toHaveLength(0)
    expect(succeeded).toHaveLength(CONCURRENCY)

    const playlistIds = [...new Set(succeeded.map((exit) => exit.value.id))]
    expect(playlistIds).toHaveLength(1)

    const links = await db
      .select()
      .from(musicEntityLinksTable)
      .where(
        and(
          eq(musicEntityLinksTable.entityType, 'playlist'),
          eq(musicEntityLinksTable.platform, 'spotify'),
          eq(musicEntityLinksTable.url, spotifyPlaylist.playlistUrl)
        )
      )
    const playlists = await db
      .select()
      .from(musicPlaylistsTable)
      .where(inArray(musicPlaylistsTable.id, playlistIds))

    expect(links).toHaveLength(1)
    expect(playlists).toHaveLength(1)
  })
})
