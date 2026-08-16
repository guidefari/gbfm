import { Effect, Exit, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicEntityResolutionClaimsTable,
  musicEntityTypesTable,
  musicPlatformsTable,
  musicPlaylistsTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import { NotFoundError, ValidationError } from '@/errors'
import type {
  MusicLinkScraperService,
  MusicScrapeInput,
  MusicScrapeOptions,
  ScrapeResult
} from '@/services/music-link-scraper.service'
import { db } from '@/test/d1'
import { addLinkEffect } from './link.service'
import {
  refreshEntityLinksEffect,
  MusicEntityResolutionUnavailable,
  scrapeAndCreateEntityEffect
} from './scrape.service'

const emptyScraper: MusicLinkScraperService = {
  scrape: () => Effect.succeed({ links: [] }),
  discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
}

beforeAll(async () => {
  await db.insert(musicEntityTypesTable).values([
    { id: 'track', displayName: 'Track' },
    { id: 'playlist', displayName: 'Playlist' }
  ])
  await db.insert(musicPlatformsTable).values([
    { id: 'other', displayName: 'Other' },
    { id: 'spotify', displayName: 'Spotify' },
    { id: 'youtube', displayName: 'YouTube' },
    { id: 'bandcamp', displayName: 'Bandcamp' },
    { id: 'deezer', displayName: 'Deezer' },
    { id: 'musicbrainz', displayName: 'MusicBrainz' }
  ])
})

const makeRefreshScraper = (
  scrape: (
    input: MusicScrapeInput,
    options?: MusicScrapeOptions
  ) => Effect.Effect<ScrapeResult, never>
): MusicLinkScraperService => ({
  scrape,
  discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
})

describe('scrapeAndCreateEntityEffect', () => {
  test('passes the requested entity type into resolution', async () => {
    let receivedInput: MusicScrapeInput | undefined
    const id = crypto.randomUUID()
    const scraper: MusicLinkScraperService = {
      scrape: (input) => {
        receivedInput = input
        return Effect.succeed({
          links: [
            {
              platform: 'other',
              url: `https://example.com/track/${id}`,
              scrapedAt: new Date()
            }
          ],
          entityMeta: { title: 'Typed Track', type: 'song' }
        })
      },
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    await Effect.runPromise(
      scrapeAndCreateEntityEffect(scraper, 'track', {
        url: `https://example.com/source/${id}`
      }).pipe(Effect.provideService(Database, db))
    )

    expect(receivedInput?.entityType).toBe('track')
  })

  test('preserves exact source provenance when creating an entity', async () => {
    const id = crypto.randomUUID()
    const url = `https://open.spotify.com/track/${id}`
    const scrapedAt = new Date('2025-02-01T00:00:00.000Z')
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.succeed({
          links: [
            {
              platform: 'spotify',
              url,
              scrapedAt,
              metadata: { discoveredBy: 'spotify', confidence: 'exact_source' }
            }
          ],
          entityMeta: { title: 'Exact Track', type: 'song' }
        }),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const result = await Effect.runPromise(
      scrapeAndCreateEntityEffect(scraper, 'track', { url }).pipe(
        Effect.provideService(Database, db)
      )
    )

    expect(result.links).toEqual([
      expect.objectContaining({
        platform: 'spotify',
        scrapedAt,
        metadata: { discoveredBy: 'spotify', confidence: 'exact_source' }
      })
    ])
  })

  test('does not persist an entity when resolution returns no metadata or links', async () => {
    const exit = await Effect.runPromiseExit(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', {}).pipe(
        Effect.provideService(Database, db)
      )
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe('Music URL resolution returned no metadata or links')
  })

  test('returns the existing entity for an exact URL before resolving again', async () => {
    const id = crypto.randomUUID()
    const url = `https://example.com/track/${id}`
    await db.insert(musicTracksTable).values({ id, title: 'Existing Track', slug: id })
    await db.insert(musicEntityLinksTable).values({
      entityType: 'track',
      entityId: id,
      platform: 'other',
      url
    })

    const result = await Effect.runPromise(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', { url }).pipe(
        Effect.provideService(Database, db)
      )
    )

    expect(result.entity.id).toBe(id)
    expect(result.links).toHaveLength(1)
    expect(result.links[0]?.url).toBe(url)
  })

  test('returns the original entity when a resolved source URL is retried', async () => {
    const sourceUrl = `https://open.spotify.com/track/${crypto.randomUUID()}?si=tracking`
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.succeed({
          links: [
            {
              platform: 'youtube',
              url: 'https://youtube.com/watch?v=resolved',
              scrapedAt: new Date()
            }
          ],
          entityMeta: { title: 'Resolved Track', artistName: 'Resolved Artist', type: 'song' }
        }),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const first = await Effect.runPromise(
      scrapeAndCreateEntityEffect(scraper, 'track', { url: sourceUrl }).pipe(
        Effect.provideService(Database, db)
      )
    )
    const second = await Effect.runPromise(
      scrapeAndCreateEntityEffect(scraper, 'track', { url: sourceUrl }).pipe(
        Effect.provideService(Database, db)
      )
    )

    expect(second.entity.id).toBe(first.entity.id)
    expect(second.links).toHaveLength(2)
  })

  test('recognizes historical normalized Spotify and YouTube links before claiming', async () => {
    const spotifyId = crypto.randomUUID()
    const youtubeId = crypto.randomUUID()
    const spotifyTrackId = crypto.randomUUID()
    const youtubeTrackId = crypto.randomUUID()
    await db.insert(musicTracksTable).values([
      { id: spotifyTrackId, title: 'Spotify Track', slug: spotifyTrackId },
      { id: youtubeTrackId, title: 'YouTube Track', slug: youtubeTrackId }
    ])
    await db.insert(musicEntityLinksTable).values([
      {
        entityType: 'track',
        entityId: spotifyTrackId,
        platform: 'spotify',
        url: `https://open.spotify.com/track/${spotifyId}?si=historical`
      },
      {
        entityType: 'track',
        entityId: youtubeTrackId,
        platform: 'youtube',
        url: `https://youtu.be/${youtubeId}?feature=historical`
      }
    ])

    const spotify = await Effect.runPromise(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', {
        url: `https://open.spotify.com/track/${spotifyId}`
      }).pipe(Effect.provideService(Database, db))
    )
    const youtube = await Effect.runPromise(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', {
        url: `https://www.youtube.com/watch?v=${youtubeId}`
      }).pipe(Effect.provideService(Database, db))
    )

    expect(spotify.entity.id).toBe(spotifyTrackId)
    expect(youtube.entity.id).toBe(youtubeTrackId)
  })

  test('reclaims an expired pending claim', async () => {
    const sourceUrl = `https://open.spotify.com/track/${crypto.randomUUID()}`
    await db.insert(musicEntityResolutionClaimsTable).values({
      entityType: 'track',
      canonicalUrl: sourceUrl,
      ownerToken: crypto.randomUUID(),
      leaseExpiresAt: new Date(Date.now() - 1)
    })
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.succeed({
          links: [],
          entityMeta: { title: 'Reclaimed Track', artistName: 'Reclaimed Artist', type: 'song' }
        }),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const result = await Effect.runPromise(
      scrapeAndCreateEntityEffect(scraper, 'track', { url: sourceUrl }).pipe(
        Effect.provideService(Database, db)
      )
    )
    const claims = (await db.select().from(musicEntityResolutionClaimsTable)).filter(
      (claim) => claim.canonicalUrl === sourceUrl
    )

    expect(claims).toEqual([
      expect.objectContaining({
        entityId: result.entity.id,
        leaseExpiresAt: null,
        ownerToken: null
      })
    ])
  })

  test('returns a typed retryable error while a pending claim lease is active', async () => {
    const sourceUrl = `https://open.spotify.com/track/${crypto.randomUUID()}`
    await db.insert(musicEntityResolutionClaimsTable).values({
      entityType: 'track',
      canonicalUrl: sourceUrl,
      ownerToken: crypto.randomUUID(),
      leaseExpiresAt: new Date(Date.now() + 60_000)
    })

    const exit = await Effect.runPromiseExit(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', { url: sourceUrl }).pipe(
        Effect.provideService(Database, db)
      )
    )
    const error = Result.getOrThrow(Exit.findError(exit))

    expect(error).toBeInstanceOf(MusicEntityResolutionUnavailable)
    expect(error).toMatchObject({ _tag: 'MusicEntityResolutionUnavailable', retryAfterMs: 30_000 })
  })

  test('does not treat notspotify.com as a Spotify source', async () => {
    const exit = await Effect.runPromiseExit(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', {
        url: `https://notspotify.com/track/${crypto.randomUUID()}`
      }).pipe(Effect.provideService(Database, db))
    )
    const error = Result.getOrThrow(Exit.findError(exit))

    expect(error).toBeInstanceOf(ValidationError)
  })

  test('reserves one canonical URL claim for concurrent resolutions', async () => {
    const sourceUrl = `https://open.spotify.com/track/${crypto.randomUUID()}?si=tracking`
    const gate = Promise.withResolvers<void>()
    const started = Promise.withResolvers<void>()
    let scrapeCalls = 0
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.promise(async () => {
          scrapeCalls += 1
          started.resolve()
          await gate.promise
          return {
            links: [
              {
                platform: 'youtube',
                url: 'https://youtube.com/watch?v=resolved',
                scrapedAt: new Date()
              }
            ],
            entityMeta: {
              title: 'Concurrent Track',
              artistName: 'Concurrent Artist',
              type: 'song'
            }
          }
        }),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const first = Effect.runPromise(
      scrapeAndCreateEntityEffect(scraper, 'track', { url: sourceUrl }).pipe(
        Effect.provideService(Database, db)
      )
    )
    await started.promise
    const second = Effect.runPromise(
      scrapeAndCreateEntityEffect(scraper, 'track', { url: sourceUrl }).pipe(
        Effect.provideService(Database, db)
      )
    )
    gate.resolve()

    const [firstResult, secondResult] = await Promise.all([first, second])
    const canonicalUrl = sourceUrl.split('?')[0] ?? sourceUrl
    const claims = (await db.select().from(musicEntityResolutionClaimsTable)).filter(
      (claim) => claim.canonicalUrl === canonicalUrl
    )

    expect(scrapeCalls).toBe(1)
    expect(secondResult.entity.id).toBe(firstResult.entity.id)
    expect(claims).toEqual([
      expect.objectContaining({ entityId: firstResult.entity.id, entityType: 'track' })
    ])
  })

  test('releases an unfinished canonical URL claim after resolution fails', async () => {
    const sourceUrl = `https://open.spotify.com/track/${crypto.randomUUID()}?si=tracking`
    const exit = await Effect.runPromiseExit(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', { url: sourceUrl }).pipe(
        Effect.provideService(Database, db)
      )
    )
    const canonicalUrl = sourceUrl.split('?')[0]
    const claims = (await db.select().from(musicEntityResolutionClaimsTable)).filter(
      (claim) => claim.canonicalUrl === canonicalUrl
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(claims).toHaveLength(0)
  })

  test('refreshes scraped and verified timestamps when a link already exists', async () => {
    const id = crypto.randomUUID()
    const original = new Date('2024-01-01T00:00:00.000Z')
    const refreshed = new Date('2025-01-01T00:00:00.000Z')
    await db.insert(musicTracksTable).values({ id, title: 'Track', slug: id })
    await Effect.runPromise(
      addLinkEffect({
        entityType: 'track',
        entityId: id,
        platform: 'youtube',
        url: 'https://youtube.com/watch?v=old',
        scrapedAt: original,
        verifiedAt: original
      }).pipe(Effect.provideService(Database, db))
    )

    const link = await Effect.runPromise(
      addLinkEffect({
        entityType: 'track',
        entityId: id,
        platform: 'youtube',
        url: 'https://youtube.com/watch?v=new',
        scrapedAt: refreshed,
        verifiedAt: refreshed
      }).pipe(Effect.provideService(Database, db))
    )

    expect(link.url).toBe('https://youtube.com/watch?v=new')
    expect(link.scrapedAt).toEqual(refreshed)
    expect(link.verifiedAt).toEqual(refreshed)
  })

  test('upserts provider links without changing entity metadata', async () => {
    const id = crypto.randomUUID()
    const spotifyUrl = `https://open.spotify.com/track/${id}`
    await db.insert(musicTracksTable).values({
      id,
      title: 'Original Track',
      slug: id,
      artistNames: ['Original Artist']
    })
    await db.insert(musicEntityLinksTable).values([
      { entityType: 'track', entityId: id, platform: 'spotify', url: spotifyUrl },
      {
        entityType: 'track',
        entityId: id,
        platform: 'youtube',
        url: 'https://youtube.com/watch?v=old'
      }
    ])
    const scraper = makeRefreshScraper(() =>
      Effect.succeed({
        links: [
          {
            platform: 'youtube',
            url: 'https://youtube.com/watch?v=new',
            scrapedAt: new Date(),
            metadata: { odesliEntityId: 'odesli-track' }
          },
          {
            platform: 'bandcamp',
            url: 'https://artist.bandcamp.com/track/track',
            scrapedAt: new Date()
          }
        ],
        entityMeta: {
          title: 'Odesli Track',
          artistName: 'Odesli Artist',
          type: 'song'
        }
      })
    )

    const result = await Effect.runPromise(
      refreshEntityLinksEffect(scraper, 'track', id).pipe(Effect.provideService(Database, db))
    )
    const tracks = await db.select().from(musicTracksTable)
    const links = await db.select().from(musicEntityLinksTable)

    expect(result.links).toHaveLength(2)
    expect(tracks.find((track) => track.id === id)?.title).toBe('Original Track')
    expect(tracks.find((track) => track.id === id)?.artistNames).toEqual(['Original Artist'])
    expect(links.find((link) => link.entityId === id && link.platform === 'youtube')?.url).toBe(
      'https://youtube.com/watch?v=new'
    )
    expect(links.find((link) => link.entityId === id && link.platform === 'bandcamp')?.url).toBe(
      'https://artist.bandcamp.com/track/track'
    )
  })

  test('fails when the entity has no stored source link', async () => {
    const id = crypto.randomUUID()
    await db.insert(musicTracksTable).values({ id, title: 'Track', slug: id })
    const exit = await Effect.runPromiseExit(
      refreshEntityLinksEffect(emptyScraper, 'track', id).pipe(Effect.provideService(Database, db))
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(NotFoundError)
    expect('resource' in error ? error.resource : undefined).toBe('MusicEntitySourceLink')
  })

  test('fails when the entity does not exist', async () => {
    const exit = await Effect.runPromiseExit(
      refreshEntityLinksEffect(emptyScraper, 'track', crypto.randomUUID()).pipe(
        Effect.provideService(Database, db)
      )
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(NotFoundError)
    expect('resource' in error ? error.resource : undefined).toBe('MusicTrack')
  })

  test('persists a partial provider result and forwards caller cancellation', async () => {
    const id = crypto.randomUUID()
    const spotifyUrl = `https://open.spotify.com/track/${id}`
    const signal = new AbortController().signal
    let receivedSignal: AbortSignal | undefined
    await db.insert(musicTracksTable).values({ id, title: 'Track', slug: id })
    await db.insert(musicEntityLinksTable).values({
      entityType: 'track',
      entityId: id,
      platform: 'spotify',
      url: spotifyUrl
    })
    const scraper = makeRefreshScraper((_input, options) => {
      receivedSignal = options?.signal
      return Effect.succeed({
        links: [
          {
            platform: 'deezer',
            url: `https://www.deezer.com/track/${id}`,
            scrapedAt: new Date()
          }
        ]
      })
    })
    const result = await Effect.runPromise(
      refreshEntityLinksEffect(scraper, 'track', id, { signal }).pipe(
        Effect.provideService(Database, db)
      )
    )

    expect(result.links).toEqual([
      expect.objectContaining({ platform: 'deezer', url: `https://www.deezer.com/track/${id}` })
    ])
    expect(receivedSignal).toBe(signal)
  })

  test('refreshes a playlist from its exact source platform only', async () => {
    const id = crypto.randomUUID()
    const deezerUrl = `https://www.deezer.com/playlist/${id}`
    let receivedInput: MusicScrapeInput | undefined
    await db.insert(musicPlaylistsTable).values({ id, title: 'Playlist', slug: id })
    await db.insert(musicEntityLinksTable).values([
      {
        entityType: 'playlist',
        entityId: id,
        platform: 'spotify',
        url: `https://open.spotify.com/playlist/${id}`
      },
      {
        entityType: 'playlist',
        entityId: id,
        platform: 'deezer',
        url: deezerUrl,
        metadata: { discoveredBy: 'deezer', confidence: 'exact_source' }
      }
    ])
    const scraper = makeRefreshScraper((input) => {
      receivedInput = input
      return Effect.succeed({
        links: [
          { platform: 'deezer', url: deezerUrl, scrapedAt: new Date() },
          {
            platform: 'youtube',
            url: `https://youtube.com/playlist?list=${id}`,
            scrapedAt: new Date()
          }
        ]
      })
    })

    const result = await Effect.runPromise(
      refreshEntityLinksEffect(scraper, 'playlist', id).pipe(Effect.provideService(Database, db))
    )
    const links = (await db.select().from(musicEntityLinksTable)).filter(
      (link) => link.entityType === 'playlist' && link.entityId === id
    )

    expect(receivedInput).toEqual({ entityType: 'playlist', url: deezerUrl })
    expect(result.links).toEqual([expect.objectContaining({ platform: 'deezer', url: deezerUrl })])
    expect(links).toEqual([expect.objectContaining({ platform: 'deezer', url: deezerUrl })])
  })

  test('deterministically collapses multiple verified playlist sources', async () => {
    const id = crypto.randomUUID()
    await db.insert(musicPlaylistsTable).values({ id, title: 'Ambiguous Playlist', slug: id })
    await db.insert(musicEntityLinksTable).values([
      {
        entityType: 'playlist',
        entityId: id,
        platform: 'spotify',
        url: `https://open.spotify.com/playlist/${id}`,
        metadata: { discoveredBy: 'spotify', confidence: 'exact_source' }
      },
      {
        entityType: 'playlist',
        entityId: id,
        platform: 'deezer',
        url: `https://www.deezer.com/playlist/${id}`,
        metadata: { discoveredBy: 'deezer', confidence: 'exact_source' }
      }
    ])

    const result = await Effect.runPromise(
      refreshEntityLinksEffect(emptyScraper, 'playlist', id).pipe(
        Effect.provideService(Database, db)
      )
    )
    const links = (await db.select().from(musicEntityLinksTable)).filter(
      (link) => link.entityType === 'playlist' && link.entityId === id
    )

    expect(result.links).toEqual([expect.objectContaining({ platform: 'deezer' })])
    expect(links).toEqual([expect.objectContaining({ platform: 'deezer' })])
  })

  test('refreshes MusicBrainz from the stored MBID and preserves redirect provenance', async () => {
    const id = crypto.randomUUID()
    const requestedMbid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const canonicalMbid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    let receivedInput: MusicScrapeInput | undefined
    await db.insert(musicTracksTable).values({ id, title: 'Track', slug: id })
    await db.insert(musicEntityLinksTable).values([
      {
        entityType: 'track',
        entityId: id,
        platform: 'spotify',
        url: `https://open.spotify.com/track/${id}`,
        metadata: { discoveredBy: 'spotify', confidence: 'exact_source' }
      },
      {
        entityType: 'track',
        entityId: id,
        platform: 'musicbrainz',
        url: `https://musicbrainz.org/recording/${requestedMbid}`,
        metadata: { mbid: requestedMbid, confidence: 'exact_mbid' }
      }
    ])
    const scraper = makeRefreshScraper((input) => {
      receivedInput = input
      return Effect.succeed({
        links: [
          {
            platform: 'musicbrainz',
            url: `https://musicbrainz.org/recording/${canonicalMbid}`,
            scrapedAt: new Date(),
            metadata: {
              discoveredBy: 'musicbrainz',
              confidence: 'exact_mbid',
              mbid: canonicalMbid,
              canonicalMbid
            }
          }
        ]
      })
    })

    await Effect.runPromise(
      refreshEntityLinksEffect(scraper, 'track', id).pipe(Effect.provideService(Database, db))
    )
    const links = await db.select().from(musicEntityLinksTable)
    const musicBrainz = links.find(
      (link) =>
        link.entityType === 'track' && link.entityId === id && link.platform === 'musicbrainz'
    )

    expect(receivedInput).toEqual({
      entityType: 'track',
      url: `https://open.spotify.com/track/${id}`,
      mbid: requestedMbid
    })
    expect(musicBrainz?.metadata).toEqual(
      expect.objectContaining({
        mbid: canonicalMbid,
        canonicalMbid,
        requestedMbid
      })
    )
  })
})
