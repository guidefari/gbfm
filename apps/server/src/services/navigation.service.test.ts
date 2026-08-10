import { randomUUID } from 'node:crypto'
import { eq, inArray, sql } from 'drizzle-orm'
import { Effect, Layer, ManagedRuntime, Schema } from 'effect'
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { DatabaseTestLayer, db } from '@/test/database'
import { navigationSeenPosts, navigationSessions } from '@/db/navigation.schema'
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

afterAll(() => navigationRuntime.dispose())

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
})
