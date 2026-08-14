import { Effect, Exit, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicEntityTypesTable,
  musicPlatformsTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import type {
  MusicLinkScraperService,
  MusicScrapeOptions,
  ProviderResult
} from '@/services/music-link-scraper.service'
import { MusicScraperError } from '@/services/music-link-scraper.service'
import { db } from '@/test/d1'
import { rescrapeOdesliLinksEffect, scrapeAndCreateEntityEffect } from './scrape.service'

const emptyScraper: MusicLinkScraperService = {
  scrape: () => Effect.succeed({ links: [] }),
  scrapeOdesli: () => Effect.succeed({ links: [] })
}

beforeAll(async () => {
  await db.insert(musicEntityTypesTable).values({ id: 'track', displayName: 'Track' })
  await db.insert(musicPlatformsTable).values([
    { id: 'other', displayName: 'Other' },
    { id: 'spotify', displayName: 'Spotify' },
    { id: 'youtube', displayName: 'YouTube' },
    { id: 'bandcamp', displayName: 'Bandcamp' }
  ])
})

const makeScraper = (
  scrapeOdesli: (
    input: { url?: string },
    options?: MusicScrapeOptions
  ) => Effect.Effect<ProviderResult, MusicScraperError>
): MusicLinkScraperService => ({
  scrape: () => Effect.succeed({ links: [] }),
  scrapeOdesli
})

describe('scrapeAndCreateEntityEffect', () => {
  test('does not persist an entity when resolution returns no metadata or links', async () => {
    const exit = await Effect.runPromiseExit(
      scrapeAndCreateEntityEffect(emptyScraper, 'track', {}).pipe(
        Effect.provideService(Database, db)
      )
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(DatabaseError)
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

  test('upserts Odesli provider links without changing entity metadata', async () => {
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
    const scraper = makeScraper(() =>
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
      rescrapeOdesliLinksEffect(scraper, 'track', id).pipe(Effect.provideService(Database, db))
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

  test('fails when the entity has no Spotify source link', async () => {
    const id = crypto.randomUUID()
    await db.insert(musicTracksTable).values({ id, title: 'Track', slug: id })
    const exit = await Effect.runPromiseExit(
      rescrapeOdesliLinksEffect(emptyScraper, 'track', id).pipe(Effect.provideService(Database, db))
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(NotFoundError)
    expect('resource' in error ? error.resource : undefined).toBe('MusicEntitySpotifyLink')
  })

  test('fails when the entity does not exist', async () => {
    const exit = await Effect.runPromiseExit(
      rescrapeOdesliLinksEffect(emptyScraper, 'track', crypto.randomUUID()).pipe(
        Effect.provideService(Database, db)
      )
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(NotFoundError)
    expect('resource' in error ? error.resource : undefined).toBe('MusicTrack')
  })

  test('preserves Odesli failures and forwards caller cancellation', async () => {
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
    const scraper = makeScraper((_input, options) =>
      Effect.andThen(
        Effect.sync(() => {
          receivedSignal = options?.signal
        }),
        Effect.fail(
          new MusicScraperError({
            message: 'Odesli unavailable',
            provider: 'odesli',
            statusCode: 504
          })
        )
      )
    )
    const exit = await Effect.runPromiseExit(
      rescrapeOdesliLinksEffect(scraper, 'track', id, { signal }).pipe(
        Effect.provideService(Database, db)
      )
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(MusicScraperError)
    expect('statusCode' in error ? error.statusCode : undefined).toBe(504)
    expect(receivedSignal).toBe(signal)
  })
})
