import { Effect, Exit, Result } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { Database } from '@/db/layer'
import {
  musicEntityLinksTable,
  musicEntityTypesTable,
  musicPlatformsTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import { DatabaseError } from '@/errors'
import type { MusicLinkScraperService } from '@/services/music-link-scraper.service'
import { db } from '@/test/d1'
import { scrapeAndCreateEntityEffect } from './scrape.service'

const emptyScraper: MusicLinkScraperService = {
  scrape: () => Effect.succeed({ links: [] })
}

beforeAll(async () => {
  await db.insert(musicEntityTypesTable).values({ id: 'track', displayName: 'Track' })
  await db.insert(musicPlatformsTable).values({ id: 'other', displayName: 'Other' })
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
})
