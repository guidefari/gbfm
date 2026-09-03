import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicEntityTypesTable,
  musicPlatformsTable,
  musicPlaylistsTable
} from '@/db/music-entity.schema'
import {
  CanonicalMusicIdentity,
  CanonicalMusicIdentityLayer,
  type CanonicalMusicIdentityService
} from '@/services/canonical-music-identity'
import {
  MusicLinkScraperService,
  type MusicScrapeInput
} from '@/services/music-link-scraper.service'
import type { S3Service } from '@/services/s3.service'
import type {
  SpotifyImportPlaylist,
  SpotifyImportTrack,
  SpotifyService
} from '@/services/spotify.service'
import { db } from '@/test/d1'
import { withTestLayer } from '@/test/effect'
import {
  addSpotifyTrackToPlaylistEffect,
  importSpotifyPlaylistEffect
} from './playlist-tracks.service'

const externalId = () => crypto.randomUUID().replaceAll('-', '').slice(0, 22)

beforeAll(async () => {
  await db
    .insert(musicEntityTypesTable)
    .values([
      { id: 'artist', displayName: 'Artist' },
      { id: 'album', displayName: 'Album' },
      { id: 'track', displayName: 'Track' },
      { id: 'playlist', displayName: 'Playlist' }
    ])
    .onConflictDoNothing()
  await db
    .insert(musicPlatformsTable)
    .values([
      { id: 'spotify', displayName: 'Spotify' },
      { id: 'deezer', displayName: 'Deezer' }
    ])
    .onConflictDoNothing()
})

const trackFixture = (spotifyTrackId: string): SpotifyImportTrack => ({
  spotifyTrackId,
  title: 'Imported track',
  artistNames: ['Artist'],
  artistSpotifyIds: [],
  albumName: null,
  albumSpotifyId: null,
  albumImageUrl: null,
  trackUrl: `https://open.spotify.com/track/${spotifyTrackId}`,
  previewUrl: null,
  durationMs: null,
  trackNumber: null
})

const artworkStore: Pick<S3Service, 'uploadFile'> = {
  uploadFile: () => Effect.die('Artwork should not be copied without an image')
}

const runWithIdentity = <A, E>(
  scraper: MusicLinkScraperService,
  use: (identity: CanonicalMusicIdentityService) => Effect.Effect<A, E, Database>
) => {
  const dependencies = Layer.merge(
    Layer.succeed(Database, db),
    Layer.succeed(MusicLinkScraperService, scraper)
  )
  const identityLayer = CanonicalMusicIdentityLayer.pipe(Layer.provide(dependencies))
  return Effect.runPromise(
    withTestLayer(
      Effect.flatMap(CanonicalMusicIdentity, use).pipe(Effect.provideService(Database, db)),
      identityLayer
    )
  )
}

describe('playlist Spotify caller migration', () => {
  test('checks canonical track identity before invoking the Spotify detail loader', async () => {
    const spotifyTrackId = externalId()
    const track = trackFixture(spotifyTrackId)
    const playlistId = crypto.randomUUID()
    await db.insert(musicPlaylistsTable).values({
      id: playlistId,
      title: 'Target playlist',
      slug: playlistId
    })
    let providerCalls = 0
    const spotify: Pick<SpotifyService, 'getTrackForImport'> = {
      getTrackForImport: () => {
        providerCalls += 1
        return Effect.die('Canonical hit must not invoke Spotify')
      }
    }
    const scraper: MusicLinkScraperService = {
      scrape: () => Effect.die('Canonical hit must not scrape'),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const result = await runWithIdentity(scraper, (identity) =>
      Effect.gen(function* () {
        yield* identity.importProviderEntity({
          snapshot: {
            entityType: 'track',
            sourceUrl: track.trackUrl,
            title: track.title,
            artistNames: track.artistNames
          },
          origin: 'spotify_import'
        })
        return yield* addSpotifyTrackToPlaylistEffect(spotify, identity)(
          playlistId,
          `${track.trackUrl}?si=test`
        )
      })
    )

    expect(providerCalls).toBe(0)
    expect(result.created).toBe(false)
  })

  test('retries enrichment for a reused track without repeating successful provider work', async () => {
    const spotifyTrackId = externalId()
    const playlistSpotifyId = externalId()
    const track = trackFixture(spotifyTrackId)
    const playlist: SpotifyImportPlaylist = {
      spotifyPlaylistId: playlistSpotifyId,
      title: 'Imported playlist',
      description: null,
      coverImageUrl: null,
      ownerName: null,
      playlistUrl: `https://open.spotify.com/playlist/${playlistSpotifyId}`,
      tracks: [track, track]
    }
    let enrichmentCalls = 0
    let playlistCalls = 0
    const inputs: MusicScrapeInput[] = []
    const scraper: MusicLinkScraperService = {
      scrape: () => Effect.die('Automatic enrichment must not refresh provider metadata'),
      discoverCrossPlatformLinks: (input) => {
        enrichmentCalls += 1
        inputs.push(input)
        return Effect.succeed({
          links: [
            {
              platform: 'deezer',
              url: `https://www.deezer.com/track/${Date.now()}`,
              scrapedAt: new Date()
            }
          ]
        })
      }
    }
    const spotify: Pick<SpotifyService, 'getPlaylistForImport'> = {
      getPlaylistForImport: () => {
        playlistCalls += 1
        return Effect.succeed(playlist)
      }
    }

    const results = await runWithIdentity(scraper, (identity) =>
      Effect.gen(function* () {
        const reused = yield* identity.importProviderEntity({
          snapshot: {
            entityType: 'track',
            sourceUrl: track.trackUrl,
            title: track.title,
            artistNames: track.artistNames
          },
          origin: 'spotify_import'
        })
        const first = yield* importSpotifyPlaylistEffect(
          spotify,
          identity,
          artworkStore,
          'https://cdn.example.com',
          'bucket'
        )(`${playlist.playlistUrl}?si=test`)
        yield* Effect.sleep('100 millis')
        const second = yield* importSpotifyPlaylistEffect(
          spotify,
          identity,
          artworkStore,
          'https://cdn.example.com',
          'bucket'
        )(`${playlist.playlistUrl}?si=test`)
        yield* Effect.sleep('100 millis')
        return { reused, first, second }
      })
    )

    expect(results.first.reusedTrackCount).toBe(2)
    expect(results.second.reusedTrackCount).toBe(2)
    expect(enrichmentCalls).toBe(1)
    expect(inputs).toHaveLength(1)
    expect(playlistCalls).toBe(2)
  })
})
