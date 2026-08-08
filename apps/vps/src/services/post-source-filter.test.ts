import { randomUUID } from 'node:crypto'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { db } from '@/test/database'
import { blueskyPostSources } from '@/db/external-account.schema'
import { postsTable } from '@/db/post.schema'
import { importedPostIds } from './post.service'

/**
 * The source filter is an uncorrelated membership subquery over
 * bluesky_post_sources. Only execution proves the generated SQL plans, so these
 * assert both membership branches against real Postgres.
 */

const importedId = randomUUID()
const nativeId = randomUUID()
const slugPrefix = `source-filter-${randomUUID().slice(0, 8)}`
const seededIds = [importedId, nativeId]

beforeAll(async () => {
  await db.insert(postsTable).values([
    {
      id: importedId,
      slug: `${slugPrefix}-imported`,
      title: 'Imported from Bluesky',
      content: 'ambient set recommendation',
      draft: true,
      type: 'micro'
    },
    {
      id: nativeId,
      slug: `${slugPrefix}-native`,
      title: 'Written here',
      content: 'ambient set recommendation',
      draft: true,
      type: 'micro'
    }
  ])

  await db.insert(blueskyPostSources).values({
    postId: importedId,
    authorDid: 'did:plc:sourcefilter',
    atUri: `at://did:plc:sourcefilter/app.bsky.feed.post/${slugPrefix}`,
    publicUrl: 'https://bsky.app/profile/test/post/1',
    sourceCreatedAt: new Date()
  })
})

afterAll(async () => {
  await db.delete(blueskyPostSources).where(eq(blueskyPostSources.postId, importedId))
  await db.delete(postsTable).where(inArray(postsTable.id, seededIds))
})

const seededMatching = (condition: ReturnType<typeof inArray>) =>
  db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(inArray(postsTable.id, seededIds))
    .then((rows) => rows.map((row) => row.id))
    .then(async (allSeeded) => {
      const filtered = await db
        .select({ id: postsTable.id })
        .from(postsTable)
        .where(condition)
        .then((rows) => rows.map((row) => row.id))
      return allSeeded.filter((id) => filtered.includes(id))
    })

describe('imported post membership predicate', () => {
  test('bluesky branch includes the imported post and excludes the native one', async () => {
    const matched = await seededMatching(inArray(postsTable.id, importedPostIds(db)))

    expect(matched).toEqual([importedId])
  })

  test('native branch includes the native post and excludes the imported one', async () => {
    const matched = await seededMatching(notInArray(postsTable.id, importedPostIds(db)))

    expect(matched).toEqual([nativeId])
  })
})

describe('imported drafts review query', () => {
  test('bluesky + micro + draft matches an imported draft and excludes a published one', async () => {
    const publishedId = randomUUID()
    await db.insert(postsTable).values({
      id: publishedId,
      slug: `${slugPrefix}-published`,
      content: 'already published import',
      draft: false,
      type: 'micro'
    })
    await db.insert(blueskyPostSources).values({
      postId: publishedId,
      authorDid: 'did:plc:sourcefilter',
      atUri: `at://did:plc:sourcefilter/app.bsky.feed.post/${slugPrefix}-pub`,
      publicUrl: 'https://bsky.app/profile/test/post/2',
      sourceCreatedAt: new Date()
    })

    const rows = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(
        and(
          inArray(postsTable.id, importedPostIds(db)),
          eq(postsTable.type, 'micro'),
          eq(postsTable.draft, true),
          inArray(postsTable.id, [importedId, publishedId])
        )
      )

    expect(rows.map((row) => row.id)).toEqual([importedId])

    await db.delete(blueskyPostSources).where(eq(blueskyPostSources.postId, publishedId))
    await db.delete(postsTable).where(eq(postsTable.id, publishedId))
  })
})
