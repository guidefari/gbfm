import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { db } from '@/test/database'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { audioIdsForCreator, showIdsForCreator } from '@/db/creator-membership'
import { showCreators, showsTable } from '@/db/show.schema'

/**
 * Every db.query.* shape in the codebase, executed against real Postgres.
 *
 * Drizzle relational queries alias the base table and build lateral joins, so
 * a predicate that is valid TypeScript can still emit invalid SQL. tsc cannot
 * catch that; only execution can. These run with no fixtures because an empty
 * result still proves the statement planned and executed.
 */

const actorId = `smoke-${randomUUID()}`

describe('relational query smoke matrix', () => {
  test('audio.service getByType, both visibility branches', async () => {
    const shape = (where: ReturnType<typeof and>) =>
      db.query.audioTable.findMany({
        where,
        limit: 1,
        offset: 0,
        orderBy: desc(audioTable.createdAt),
        with: {
          audioCreators: { with: { creator: true } },
          show: { columns: { thumbnailUrl: true } }
        }
      })

    await expect(
      shape(and(eq(audioTable.type, 'mix'), eq(audioTable.draft, false)))
    ).resolves.toBeDefined()
    await expect(
      shape(and(eq(audioTable.type, 'mix'), audioIdsForCreator(db, actorId)))
    ).resolves.toBeDefined()
  })

  test('audio.service getBySlug', async () => {
    await expect(
      db.query.audioTable.findFirst({
        where: and(eq(audioTable.type, 'mix'), eq(audioTable.slug, 'smoke-missing')),
        with: {
          audioCreators: { with: { creator: true } },
          show: { columns: { thumbnailUrl: true } }
        }
      })
    ).resolves.toBeUndefined()
  })

  test('audio.service audioCreators and show lookups', async () => {
    await expect(
      db.query.audioCreators.findMany({
        where: eq(audioCreators.creatorId, actorId),
        with: { creator: true }
      })
    ).resolves.toBeDefined()

    await expect(
      db.query.showsTable.findFirst({
        where: eq(showsTable.slug, 'smoke-missing'),
        columns: { thumbnailUrl: true }
      })
    ).resolves.toBeUndefined()
  })

  test('profile.service public mixes', async () => {
    await expect(
      db.query.audioTable.findMany({
        columns: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          type: true,
          showId: true
        },
        with: { show: { columns: { thumbnailUrl: true } } },
        where: and(audioIdsForCreator(db, actorId), eq(audioTable.draft, false)),
        orderBy: asc(audioTable.createdAt)
      })
    ).resolves.toBeDefined()
  })

  test('show.service getAll, both visibility branches', async () => {
    const shape = (where: ReturnType<typeof and>) =>
      db.query.showsTable.findMany({
        where,
        limit: 1,
        offset: 0,
        orderBy: [desc(showsTable.createdAt), asc(showsTable.title)],
        with: { showCreators: { with: { creator: true } } }
      })

    await expect(shape(eq(showsTable.draft, false))).resolves.toBeDefined()
    await expect(shape(showIdsForCreator(db, actorId))).resolves.toBeDefined()
  })

  test('show.service getBySlug, getEpisodes, showCreators', async () => {
    await expect(
      db.query.showsTable.findFirst({
        where: and(eq(showsTable.slug, 'smoke-missing'), eq(showsTable.draft, false)),
        with: { showCreators: { with: { creator: true } } }
      })
    ).resolves.toBeUndefined()

    await expect(
      db.query.audioTable.findMany({
        where: eq(audioTable.showId, randomUUID()),
        limit: 1,
        offset: 0,
        orderBy: desc(audioTable.createdAt),
        with: {
          audioCreators: { with: { creator: true } },
          show: { columns: { thumbnailUrl: true } }
        }
      })
    ).resolves.toBeDefined()

    await expect(
      db.query.showCreators.findMany({
        where: eq(showCreators.creatorId, actorId),
        with: { creator: true }
      })
    ).resolves.toBeDefined()
  })

  test('search.service audio search', async () => {
    await expect(
      db.query.audioTable.findMany({
        with: { show: { columns: { thumbnailUrl: true } } },
        where: and(
          eq(audioTable.draft, false),
          or(ilike(audioTable.title, '%smoke%'), ilike(audioTable.slug, '%smoke%'))
        ),
        limit: 1
      })
    ).resolves.toBeDefined()
  })

  test('site-routes and email handlers share card lookups', async () => {
    await expect(
      db.query.audioTable.findFirst({
        where: and(
          eq(audioTable.type, 'mix'),
          eq(audioTable.slug, 'smoke-missing'),
          eq(audioTable.draft, false)
        ),
        with: { show: { columns: { thumbnailUrl: true } } }
      })
    ).resolves.toBeUndefined()

    await expect(
      db.query.audioTable.findFirst({
        where: and(eq(audioTable.id, randomUUID()), eq(audioTable.draft, false)),
        with: { show: { columns: { thumbnailUrl: true } } }
      })
    ).resolves.toBeUndefined()
  })
})
