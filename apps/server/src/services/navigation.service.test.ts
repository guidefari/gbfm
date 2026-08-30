import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import { randomUUID } from 'node:crypto'
import { eq, inArray, sql } from 'drizzle-orm'
import { Effect, Layer, ManagedRuntime, Schema } from 'effect'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { DatabaseLayer } from '@/db/layer'
import { DatabaseTestLayer, d1, db } from '@/test/database'
import {
  navigationSeenPosts,
  navigationSessions,
  navigationTrailEntries
} from '@/db/navigation.schema'
import { postsTable } from '@/db/post.schema'
import { CorpusExhausted, Slug } from '@/domain/navigation'
import { MdxServiceLayer } from '@/lib/mdx'
import { ConfigServiceLayer } from '@/services/config.service'
import { NavigationLockLocalLayer } from '@/services/navigation-lock'
import { PostServiceLayer } from '@/services/post.service'
import { UploadAssetServiceLayer } from '@/services/upload-asset.service'
import {
  NavigationSessionService,
  NavigationSessionServiceLayer,
  type IntentToken
} from './navigation.service'

const slug = Schema.decodeUnknownSync(Slug)
const prefix = `navigation-service-${randomUUID().slice(0, 8)}`
const postIds: string[] = []
const sessionIds: string[] = []
const readerTokens: string[] = []

const postLayer = PostServiceLayer.pipe(
  Layer.provide(MdxServiceLayer),
  Layer.provide(Layer.mergeAll(ConfigServiceLayer, UploadAssetServiceLayer))
)
const navigationLayer = NavigationSessionServiceLayer.pipe(
  Layer.provide(postLayer),
  Layer.provide(DatabaseTestLayer),
  Layer.provide(NavigationLockLocalLayer)
)
const navigationRuntime = ManagedRuntime.make(navigationLayer)

let roundTrips = 0

const countedMethods = ['all', 'run', 'first', 'raw'] as const

const countStatement = (statement: D1PreparedStatement): D1PreparedStatement =>
  new Proxy(statement, {
    get: (target, key: string | symbol) => {
      if (key === 'bind') {
        return (...values: readonly unknown[]) => countStatement(target.bind(...values))
      }
      const isCounted = countedMethods.some((method) => method === key)
      if (isCounted) {
        return async (...args: readonly unknown[]) => {
          roundTrips += 1
          return Reflect.apply(Reflect.get(target, key), target, args)
        }
      }
      return Reflect.get(target, key, target)
    }
  })

const countingD1: D1Database = new Proxy(d1, {
  get: (target, key: string | symbol) => {
    if (key === 'prepare') {
      return (query: string) => countStatement(target.prepare(query))
    }
    if (key === 'batch') {
      return async (statements: readonly D1PreparedStatement[]) => {
        roundTrips += 1
        return target.batch([...statements])
      }
    }
    return Reflect.get(target, key, target)
  }
})

const countingRuntime = ManagedRuntime.make(
  NavigationSessionServiceLayer.pipe(
    Layer.provide(postLayer),
    Layer.provide(DatabaseLayer(countingD1)),
    Layer.provide(NavigationLockLocalLayer)
  )
)

const peek = (
  identity: { readonly _tag: 'Anonymous'; readonly deviceToken: string },
  command:
    | { readonly _tag: 'Step'; readonly direction: 'Back' | 'Forward' }
    | { readonly _tag: 'Jump' }
    | { readonly _tag: 'Open'; readonly slug: Slug },
  from: Slug
) =>
  Effect.gen(function* () {
    const navigation = yield* NavigationSessionService
    return yield* navigation.peek(identity, command, from)
  })

const record = (
  identity: { readonly _tag: 'Anonymous'; readonly deviceToken: string },
  command:
    | { readonly _tag: 'Step'; readonly direction: 'Back' | 'Forward' }
    | { readonly _tag: 'Jump' }
    | { readonly _tag: 'Open'; readonly slug: Slug },
  from: Slug,
  intentToken: IntentToken
) =>
  Effect.gen(function* () {
    const navigation = yield* NavigationSessionService
    return yield* navigation.record(identity, command, from, intentToken)
  })

const read = (identity: { readonly _tag: 'Anonymous'; readonly deviceToken: string }) =>
  Effect.gen(function* () {
    const navigation = yield* NavigationSessionService
    return yield* navigation.read(identity)
  })

const resolve = (
  identity: { readonly _tag: 'Anonymous'; readonly deviceToken: string },
  command:
    | { readonly _tag: 'Step'; readonly direction: 'Back' | 'Forward' }
    | { readonly _tag: 'Jump' }
    | { readonly _tag: 'Open'; readonly slug: Slug },
  from: Slug,
  intentToken: IntentToken
) =>
  Effect.gen(function* () {
    const navigation = yield* NavigationSessionService
    return yield* navigation.resolve(identity, command, from, intentToken)
  })

const createPost = async (name: string, createdAt: Date) => {
  const id = randomUUID()
  const value = slug(`${prefix}-${name}-${id.slice(0, 8)}`)
  postIds.push(id)
  await db.insert(postsTable).values({
    id,
    slug: value,
    title: name,
    content: name,
    type: 'micro',
    createdAt,
    updatedAt: createdAt
  })
  return { id, slug: value }
}

const identity = () => {
  const deviceToken = randomUUID()
  readerTokens.push(deviceToken)
  return { _tag: 'Anonymous' as const, deviceToken }
}

const sessionFor = async (deviceToken: string) => {
  const rows = await db
    .select()
    .from(navigationSessions)
    .where(eq(navigationSessions.deviceToken, deviceToken))
    .limit(1)
  const session = rows[0]
  if (!session) throw new Error('Expected navigation session')
  sessionIds.push(session.id)
  return session
}

const open = (reader: ReturnType<typeof identity>, post: { readonly slug: Slug }) =>
  navigationRuntime.runPromise(
    resolve(reader, { _tag: 'Open', slug: post.slug }, post.slug, randomUUID())
  )

beforeAll(async () => {
  await db.run(sql`SELECT 1`)
})

afterAll(async () => {
  await navigationRuntime.dispose()
  await countingRuntime.dispose()
})

afterEach(async () => {
  if (readerTokens.length > 0) {
    await db
      .delete(navigationSessions)
      .where(inArray(navigationSessions.deviceToken, readerTokens.splice(0)))
  }
  sessionIds.splice(0)
  if (postIds.length > 0) {
    await db.delete(postsTable).where(inArray(postsTable.id, postIds.splice(0)))
  }
})

describe('NavigationSessionService', () => {
  test('serializes concurrent forward resolves without losing a cursor update', async () => {
    const first = await createPost('concurrent-first', new Date('2026-01-03T00:00:00.000Z'))
    const second = await createPost('concurrent-second', new Date('2026-01-02T00:00:00.000Z'))
    const third = await createPost('concurrent-third', new Date('2026-01-01T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    const results = await Promise.all([
      navigationRuntime.runPromise(
        resolve(reader, { _tag: 'Step', direction: 'Forward' }, first.slug, randomUUID())
      ),
      navigationRuntime.runPromise(
        resolve(reader, { _tag: 'Step', direction: 'Forward' }, first.slug, randomUUID())
      )
    ])
    const session = await sessionFor(reader.deviceToken)

    expect(results.map((result) => result.destination.slug).toSorted()).toEqual(
      [second.slug, third.slug].toSorted()
    )
    expect(session.cursor).toBe(2)
  })

  test('skips a deleted trail entry when stepping back', async () => {
    const first = await createPost('deleted-first', new Date('2026-02-01T00:00:00.000Z'))
    const deleted = await createPost('deleted-middle', new Date('2026-02-02T00:00:00.000Z'))
    const last = await createPost('deleted-last', new Date('2026-02-03T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    await open(reader, deleted)
    await open(reader, last)
    await db.delete(postsTable).where(eq(postsTable.id, deleted.id))

    const result = await navigationRuntime.runPromise(
      resolve(reader, { _tag: 'Step', direction: 'Back' }, last.slug, randomUUID())
    )

    expect(result.destination.slug).toBe(first.slug)
    expect(result.trailPosition).toEqual({ index: 0, length: 2 })
  })

  test('skips a drafted trail entry when stepping back', async () => {
    const first = await createPost('draft-first', new Date('2026-03-01T00:00:00.000Z'))
    const drafted = await createPost('draft-middle', new Date('2026-03-02T00:00:00.000Z'))
    const last = await createPost('draft-last', new Date('2026-03-03T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    await open(reader, drafted)
    await open(reader, last)
    await db.update(postsTable).set({ draft: true }).where(eq(postsTable.id, drafted.id))

    const result = await navigationRuntime.runPromise(
      resolve(reader, { _tag: 'Step', direction: 'Back' }, last.slug, randomUUID())
    )

    expect(result.destination.slug).toBe(first.slug)
    expect(result.trailPosition).toEqual({ index: 0, length: 2 })
  })

  test('reports no unread posts or forward move after the corpus is exhausted', async () => {
    const only = await createPost('read-exhausted-only', new Date('2026-03-15T00:00:00.000Z'))
    const reader = identity()

    await open(reader, only)

    await expect(navigationRuntime.runPromise(read(reader))).resolves.toEqual({
      slug: only.slug,
      capabilities: { canStepBack: false, canStepForward: false, hasUnread: false }
    })
  })

  test('reports Step(Back) as available from the middle of a trail', async () => {
    const first = await createPost('read-middle-first', new Date('2026-03-18T00:00:00.000Z'))
    const middle = await createPost('read-middle-middle', new Date('2026-03-19T00:00:00.000Z'))
    const last = await createPost('read-middle-last', new Date('2026-03-20T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    await open(reader, middle)
    await open(reader, last)
    const session = await sessionFor(reader.deviceToken)
    await db
      .update(navigationSessions)
      .set({ cursor: 1 })
      .where(eq(navigationSessions.id, session.id))

    await expect(navigationRuntime.runPromise(read(reader))).resolves.toMatchObject({
      slug: middle.slug,
      capabilities: { canStepBack: true }
    })
  })

  test('does not recycle seen posts when the corpus is exhausted', async () => {
    const only = await createPost('exhausted-only', new Date('2026-04-01T00:00:00.000Z'))
    const reader = identity()

    await open(reader, only)
    const before = await sessionFor(reader.deviceToken)

    await expect(
      navigationRuntime.runPromise(
        resolve(reader, { _tag: 'Step', direction: 'Forward' }, only.slug, randomUUID())
      )
    ).rejects.toBeInstanceOf(CorpusExhausted)
    await expect(
      navigationRuntime.runPromise(resolve(reader, { _tag: 'Jump' }, only.slug, randomUUID()))
    ).rejects.toBeInstanceOf(CorpusExhausted)

    const seen = await db
      .select({ slug: navigationSeenPosts.slug })
      .from(navigationSeenPosts)
      .where(eq(navigationSeenPosts.sessionId, before.id))

    expect(seen).toEqual([{ slug: only.slug }])
  })

  test('retries once after a concurrent cursor change and uses the newer cursor', async () => {
    const first = await createPost('retry-first', new Date('2026-05-03T00:00:00.000Z'))
    const second = await createPost('retry-second', new Date('2026-05-02T00:00:00.000Z'))
    const third = await createPost('retry-third', new Date('2026-05-01T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    const [firstResult, retriedResult] = await Promise.all([
      navigationRuntime.runPromise(
        resolve(reader, { _tag: 'Step', direction: 'Forward' }, first.slug, randomUUID())
      ),
      navigationRuntime.runPromise(
        resolve(reader, { _tag: 'Step', direction: 'Forward' }, first.slug, randomUUID())
      )
    ])

    expect([firstResult.destination.slug, retriedResult.destination.slug].toSorted()).toEqual(
      [second.slug, third.slug].toSorted()
    )
    const session = await sessionFor(reader.deviceToken)
    expect(session.cursor).toBe(2)
  })

  test('suggests the next unread post when there is no forward trail entry', async () => {
    const newest = await createPost('suggest-newest', new Date('2026-05-20T00:00:00.000Z'))
    const next = await createPost('suggest-next', new Date('2026-05-19T00:00:00.000Z'))
    const reader = identity()

    const result = await open(reader, newest)

    expect(result.neighbours.forward).toBe(next.slug)
  })

  test('moves the cursor when replaying Step(Back)', async () => {
    const first = await createPost('replay-first', new Date('2026-06-01T00:00:00.000Z'))
    const last = await createPost('replay-last', new Date('2026-06-02T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    await open(reader, last)
    const before = await sessionFor(reader.deviceToken)

    const result = await navigationRuntime.runPromise(
      resolve(reader, { _tag: 'Step', direction: 'Back' }, last.slug, randomUUID())
    )
    const after = await sessionFor(reader.deviceToken)

    expect(result.destination.slug).toBe(first.slug)
    expect(before.cursor).toBe(1)
    expect(after.cursor).toBe(0)
  })
  test('peeks the current slug without writing to the trail', async () => {
    const first = await createPost('peek-first', new Date('2026-07-01T00:00:00.000Z'))
    const second = await createPost('peek-second', new Date('2026-06-30T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    const before = await sessionFor(reader.deviceToken)
    const trailBefore = await db
      .select()
      .from(navigationTrailEntries)
      .where(eq(navigationTrailEntries.sessionId, before.id))

    const peeked = await navigationRuntime.runPromise(
      peek(reader, { _tag: 'Open', slug: first.slug }, first.slug)
    )

    const after = await sessionFor(reader.deviceToken)
    const trailAfter = await db
      .select()
      .from(navigationTrailEntries)
      .where(eq(navigationTrailEntries.sessionId, before.id))

    expect(peeked.destination.slug).toBe(first.slug)
    expect(peeked.neighbours.forward).toBe(second.slug)
    expect(after.cursor).toBe(before.cursor)
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime())
    expect(trailAfter.length).toBe(trailBefore.length)
  })

  test('peek matches resolve for a replayed Step(Back)', async () => {
    const first = await createPost('peek-back-first', new Date('2026-07-05T00:00:00.000Z'))
    const last = await createPost('peek-back-last', new Date('2026-07-06T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    await open(reader, last)

    const peeked = await navigationRuntime.runPromise(
      peek(reader, { _tag: 'Step', direction: 'Back' }, last.slug)
    )
    const resolved = await navigationRuntime.runPromise(
      resolve(reader, { _tag: 'Step', direction: 'Back' }, last.slug, randomUUID())
    )

    expect(peeked.destination.slug).toBe(first.slug)
    expect(peeked.destination.slug).toBe(resolved.destination.slug)
    expect(peeked.trailPosition).toEqual(resolved.trailPosition)
    expect(peeked.capabilities).toEqual(resolved.capabilities)
    expect(peeked.neighbours).toEqual(resolved.neighbours)
  })

  test('peek reports the next unread destination for Step(Forward) without recording it', async () => {
    const first = await createPost('peek-fwd-first', new Date('2026-07-10T00:00:00.000Z'))
    const next = await createPost('peek-fwd-next', new Date('2026-07-09T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    const before = await sessionFor(reader.deviceToken)

    const peeked = await navigationRuntime.runPromise(
      peek(reader, { _tag: 'Step', direction: 'Forward' }, first.slug)
    )
    const seen = await db
      .select({ slug: navigationSeenPosts.slug })
      .from(navigationSeenPosts)
      .where(eq(navigationSeenPosts.sessionId, before.id))

    expect(peeked.destination.slug).toBe(next.slug)
    expect(seen).toEqual([{ slug: first.slug }])
  })

  test('record persists the visit that a peek only previewed', async () => {
    const first = await createPost('record-first', new Date('2026-07-14T00:00:00.000Z'))
    const next = await createPost('record-next', new Date('2026-07-13T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    const peeked = await navigationRuntime.runPromise(
      peek(reader, { _tag: 'Step', direction: 'Forward' }, first.slug)
    )
    const outcome = await navigationRuntime.runPromise(
      record(reader, { _tag: 'Step', direction: 'Forward' }, first.slug, randomUUID())
    )

    const session = await sessionFor(reader.deviceToken)
    const seen = await db
      .select({ slug: navigationSeenPosts.slug })
      .from(navigationSeenPosts)
      .where(eq(navigationSeenPosts.sessionId, session.id))

    expect(peeked.destination.slug).toBe(next.slug)
    expect(outcome).toEqual({ recorded: true })
    expect(session.cursor).toBe(1)
    expect(seen.map((row) => row.slug).toSorted()).toEqual([first.slug, next.slug].toSorted())
  })

  test('returns several forward slugs in the neighbourhood', async () => {
    const first = await createPost('depth-first', new Date('2026-08-01T00:00:00.000Z'))
    const second = await createPost('depth-second', new Date('2026-07-31T00:00:00.000Z'))
    const third = await createPost('depth-third', new Date('2026-07-30T00:00:00.000Z'))
    const reader = identity()

    const result = await open(reader, first)

    expect(result.neighbours.forward).toBe(second.slug)
    expect(result.neighbourhood.forward).toEqual([second.slug, third.slug])
    expect(result.neighbourhood.back).toEqual([])
  })

  test('returns several back slugs in the neighbourhood after walking a trail', async () => {
    const first = await createPost('depth-back-first', new Date('2026-08-10T00:00:00.000Z'))
    const second = await createPost('depth-back-second', new Date('2026-08-11T00:00:00.000Z'))
    const third = await createPost('depth-back-third', new Date('2026-08-12T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)
    await open(reader, second)
    const result = await open(reader, third)

    expect(result.neighbours.back).toBe(second.slug)
    expect(result.neighbourhood.back).toEqual([second.slug, first.slug])
  })

  test('does not offer a seen post as unread after the anti-join filter', async () => {
    const first = await createPost('antijoin-first', new Date('2026-09-01T00:00:00.000Z'))
    const second = await createPost('antijoin-second', new Date('2026-08-31T00:00:00.000Z'))
    const other = identity()
    const reader = identity()

    await open(other, first)
    await open(other, second)
    await open(reader, first)

    const result = await navigationRuntime.runPromise(
      resolve(reader, { _tag: 'Step', direction: 'Forward' }, first.slug, randomUUID())
    )

    expect(result.destination.slug).toBe(second.slug)
    expect(result.capabilities.hasUnread).toBe(false)
  })
  test('peeks a replayed Open in a single database round trip', async () => {
    const first = await createPost('roundtrip-first', new Date('2026-10-01T00:00:00.000Z'))
    await createPost('roundtrip-second', new Date('2026-09-30T00:00:00.000Z'))
    const reader = identity()

    await open(reader, first)

    roundTrips = 0
    const result = await countingRuntime.runPromise(
      peek(reader, { _tag: 'Open', slug: first.slug }, first.slug)
    )

    expect(result.destination.slug).toBe(first.slug)
    expect(roundTrips).toBe(1)
  })
})
