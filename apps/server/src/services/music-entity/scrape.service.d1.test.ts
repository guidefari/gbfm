import { Effect, Exit, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicEntityTypesTable,
  musicPlatformsTable,
  musicSourceIdentitiesTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import { ValidationError } from '@/errors'
import type {
  MusicLinkScraperService,
  MusicScrapeInput
} from '@/services/music-link-scraper.service'
import { db } from '@/test/d1'
import { scrapeAndCreateEntityWithoutSourceEffect } from './scrape.service'

const emptyScraper: MusicLinkScraperService = {
  scrape: () => Effect.succeed({ links: [] }),
  discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
}

beforeAll(async () => {
  await db.insert(musicEntityTypesTable).values([
    { id: 'artist', displayName: 'Artist' },
    { id: 'album', displayName: 'Album' },
    { id: 'track', displayName: 'Track' },
    { id: 'playlist', displayName: 'Playlist' }
  ])
  await db.insert(musicPlatformsTable).values([
    { id: 'other', displayName: 'Other' },
    { id: 'spotify', displayName: 'Spotify' }
  ])
})

describe('scrapeAndCreateEntityWithoutSourceEffect', () => {
  test('creates a metadata-only entity without claiming a source identity', async () => {
    let receivedInput: MusicScrapeInput | undefined
    const marker = crypto.randomUUID()
    const scraper: MusicLinkScraperService = {
      scrape: (input) => {
        receivedInput = input
        return Effect.succeed({
          links: [],
          entityMeta: { title: `Metadata Track ${marker}`, type: 'song' }
        })
      },
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const beforeIdentities = await db.select().from(musicSourceIdentitiesTable)
    const result = await Effect.runPromise(
      scrapeAndCreateEntityWithoutSourceEffect(scraper, 'track', {
        trackTitle: `Metadata Track ${marker}`
      }).pipe(Effect.provideService(Database, db))
    )
    const afterIdentities = await db.select().from(musicSourceIdentitiesTable)
    const tracks = await db.select().from(musicTracksTable)

    expect(receivedInput).toMatchObject({
      entityType: 'track',
      trackTitle: `Metadata Track ${marker}`
    })
    expect(result.entity.id).toBeTruthy()
    expect(tracks.some((track) => track.id === result.entity.id)).toBe(true)
    expect(afterIdentities).toHaveLength(beforeIdentities.length)
  })

  test('persists discovered links for the created entity', async () => {
    const marker = crypto.randomUUID()
    const url = `https://example.com/track/${marker}`
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.succeed({
          links: [{ platform: 'other', url, scrapedAt: new Date() }],
          entityMeta: { title: `Linked Track ${marker}`, type: 'song' }
        }),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }

    const result = await Effect.runPromise(
      scrapeAndCreateEntityWithoutSourceEffect(scraper, 'track', {
        trackTitle: `Linked Track ${marker}`
      }).pipe(Effect.provideService(Database, db))
    )
    const links = await db.select().from(musicEntityLinksTable)

    expect(result.links).toEqual([expect.objectContaining({ entityId: result.entity.id, url })])
    expect(links.some((link) => link.entityId === result.entity.id && link.url === url)).toBe(true)
  })

  test('rejects a provider result with no metadata or links', async () => {
    const exit = await Effect.runPromiseExit(
      scrapeAndCreateEntityWithoutSourceEffect(emptyScraper, 'track', {}).pipe(
        Effect.provideService(Database, db)
      )
    )

    const error = Result.getOrThrow(Exit.findError(exit))
    expect(error).toBeInstanceOf(ValidationError)
    expect(error.message).toBe('Music metadata resolution returned no metadata or links')
  })
})
