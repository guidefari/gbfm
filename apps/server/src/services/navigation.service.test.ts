import { eq, inArray } from 'drizzle-orm'
import { Data, Effect, Layer } from 'effect'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { navigationSessions } from '@/db/navigation.schema'
import { postsTable } from '@/db/post.schema'
import type { NavigationIdentity } from '@/domain/navigation'
import { DatabaseTestLayer, db } from '@/test/database'
import { withTestLayer } from '@/test/effect'

import { NavigationService, NavigationServiceLayer } from './navigation.service'

const identity = Data.taggedEnum<NavigationIdentity>().Anonymous({
  deviceToken: crypto.randomUUID(),
})

const prefix = `navigation-${crypto.randomUUID()}`

const slugs = ['a', 'b', 'c', 'draft', 'reply'].map((suffix) => `${prefix}-${suffix}`)

const [a = '', b = '', c = '', draft = '', reply = ''] = slugs

const layer = NavigationServiceLayer.pipe(Layer.provide(DatabaseTestLayer))

const neighbours = (slug: string) =>
  Effect.runPromise(
    withTestLayer(
      Effect.flatMap(NavigationService, (service) => service.neighbours(identity, slug)),
      layer,
    ),
  )

const reset = () =>
  Effect.runPromise(
    withTestLayer(
      Effect.flatMap(NavigationService, (service) => service.resetSeen(identity)),
      layer,
    ),
  )

const otherIdentity = Data.taggedEnum<NavigationIdentity>().Anonymous({
  deviceToken: crypto.randomUUID(),
})

const seen = (slug: string) =>
  Effect.runPromise(
    withTestLayer(
      Effect.flatMap(NavigationService, (service) => service.markSeen(identity, slug)),
      layer,
    ),
  )

beforeAll(async () => {
  const at = new Date('2024-04-01T00:00:00Z')
  await db.insert(postsTable).values(
    [a, b, c].map((slug) => ({
      slug,
      type: 'micro' as const,
      content: slug,
      draft: false,
      createdAt: at,
    })),
  )

  const [root] = await db
    .select({ id: postsTable.id })
    .from(postsTable)
    .where(eq(postsTable.slug, b))

  if (!root) throw new Error('Missing navigation fixture')
  await db.insert(postsTable).values([
    { slug: draft, type: 'micro', content: draft, draft: true, createdAt: at },
    {
      slug: reply,
      type: 'micro',
      content: reply,
      draft: false,
      parentPostId: root.id,
      createdAt: at,
    },
  ])
})

afterAll(async () => {
  await db.delete(postsTable).where(inArray(postsTable.slug, slugs))
  await db
    .delete(navigationSessions)
    .where(
      inArray(navigationSessions.deviceToken, [identity.deviceToken, otherIdentity.deviceToken]),
    )
})

test('adjacent and unread neighbours use timestamp and slug ordering, excluding replies and drafts', async () => {
  const initial = await neighbours(b)
  expect(initial.newer).toBe(c)
  expect(initial.older).toBe(a)
  expect(initial.olderUnread).toBe(a)
  expect(initial.newerUnread).toBe(c)
  await seen(a)
  const afterOlder = await neighbours(b)
  expect(afterOlder.older).toBe(a)
  expect(afterOlder.olderUnread).toBeNull()
  expect(afterOlder.newerUnread).toBe(c)
  await seen(b)
  await seen(b)
  const once = await neighbours(b)
  expect(once.seen).toBe(true)
  expect(once.unreadCount).toBe(afterOlder.unreadCount)
  expect(once.timeline.find((month) => month.month === '2024-04')?.unread).toBe(1)
  await seen(reply)
  expect((await neighbours(b)).timeline).toEqual(once.timeline)
  await seen(c)
  const exhausted = await neighbours(b)
  expect(exhausted.olderUnread).toBeNull()
  expect(exhausted.newerUnread).toBeNull()
  expect(exhausted.unreadCount).toBe(0)
})

test('resetting reading history marks every tweet unread again for that identity only', async () => {
  await seen(a)
  await seen(c)
  await Effect.runPromise(
    withTestLayer(
      Effect.flatMap(NavigationService, (service) => service.markSeen(otherIdentity, a)),
      layer,
    ),
  )

  await reset()

  const afterReset = await neighbours(b)
  expect(afterReset.seen).toBe(false)
  expect(afterReset.olderUnread).toBe(a)
  expect(afterReset.newerUnread).toBe(c)

  const other = await Effect.runPromise(
    withTestLayer(
      Effect.flatMap(NavigationService, (service) => service.neighbours(otherIdentity, b)),
      layer,
    ),
  )

  expect(other.olderUnread).toBeNull()
})
