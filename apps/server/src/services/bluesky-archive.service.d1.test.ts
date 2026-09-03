import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { beforeAll, describe, expect, test } from 'vitest'
import { user } from '@/db/auth.schema'
import { externalAccounts } from '@/db/external-account.schema'
import { musicEntityTypesTable, musicPlatformsTable } from '@/db/music-entity.schema'
import { postCreators, postsTable } from '@/db/post.schema'
import { Database } from '@/db/layer'
import { MusicLinkScraperService, MusicScraperError } from '@/services/music-link-scraper.service'
import { db } from '@/test/d1'
import { withTestLayer } from '@/test/effect'
import type { ImportedRecord } from './bluesky-importer.service'
import { BlueskyArchiveService, BlueskyArchiveServiceLayer } from './bluesky-archive.service'
import { CanonicalMusicIdentityLayer } from './canonical-music-identity'

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
    .values({ id: 'spotify', displayName: 'Spotify' })
    .onConflictDoNothing()
})

const record = (id: string, candidateUrl: string): ImportedRecord => ({
  atUri: `at://did:plc:test/app.bsky.feed.post/${id}`,
  cid: `cid-${id}`,
  authorDid: 'did:plc:test',
  authorHandle: 'test.example',
  text: 'Archived post',
  normalizedContent: 'Archived post',
  candidateUrls: [candidateUrl],
  tags: [],
  publicUrl: `https://bsky.app/profile/test.example/post/${id}`,
  sourceCreatedAt: new Date()
})

const runArchive = async (scraper: MusicLinkScraperService, importedRecord: ImportedRecord) => {
  const ownerUserId = crypto.randomUUID()
  const externalAccountId = crypto.randomUUID()
  await db.insert(user).values({
    id: ownerUserId,
    name: 'Bluesky owner',
    email: `${ownerUserId}@example.com`
  })
  await db.insert(externalAccounts).values({
    id: externalAccountId,
    userId: ownerUserId,
    provider: 'bluesky',
    providerAccountId: importedRecord.authorDid
  })

  const dependencies = Layer.merge(
    Layer.succeed(Database, db),
    Layer.succeed(MusicLinkScraperService, scraper)
  )
  const identityLayer = CanonicalMusicIdentityLayer.pipe(Layer.provide(dependencies))
  const archiveLayer = BlueskyArchiveServiceLayer.pipe(
    Layer.provide(Layer.merge(dependencies, identityLayer))
  )
  const summary = await Effect.runPromise(
    withTestLayer(
      Effect.flatMap(BlueskyArchiveService, (archive) =>
        archive.write({ ownerUserId, externalAccountId, records: [importedRecord] })
      ),
      archiveLayer
    )
  )
  const posts = await db
    .select({ post: postsTable })
    .from(postCreators)
    .innerJoin(postsTable, eq(postCreators.postId, postsTable.id))
    .where(eq(postCreators.creatorId, ownerUserId))
    .then((rows) => rows.map((row) => row.post))
  return { summary, posts }
}

describe('BlueskyArchiveService', () => {
  test('archives a post when optional music resolution fails', async () => {
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.fail(
          new MusicScraperError({
            provider: 'spotify',
            statusCode: 503,
            message: 'unavailable'
          })
        ),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }
    const result = await runArchive(
      scraper,
      record(
        crypto.randomUUID(),
        `https://open.spotify.com/track/${crypto.randomUUID().replaceAll('-', '')}`
      )
    )

    expect(result.summary).toMatchObject({ created: 1, failed: 0 })
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]).toMatchObject({ musicEntityType: null, musicEntityId: null })
  })

  test('stores the canonical inferred playlist type after music resolution', async () => {
    const scraper: MusicLinkScraperService = {
      scrape: () =>
        Effect.succeed({
          links: [],
          entityMeta: { title: 'Resolved playlist', type: 'playlist' }
        }),
      discoverCrossPlatformLinks: () => Effect.succeed({ links: [] })
    }
    const result = await runArchive(
      scraper,
      record(
        crypto.randomUUID(),
        `https://open.spotify.com/playlist/${crypto.randomUUID().replaceAll('-', '')}`
      )
    )

    expect(result.summary).toMatchObject({ created: 1, failed: 0 })
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]?.musicEntityType).toBe('playlist')
    expect(result.posts[0]?.musicEntityId).toBeTruthy()
  })
})
