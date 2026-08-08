import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { user } from '@/db/auth.schema'
import { DatabaseTestLayer, db } from '@/test/database'
import { navigationSessions } from '@/db/navigation.schema'
import {
  ANONYMOUS_NAVIGATION_SESSION_RETENTION_MS,
  NavigationRetentionService,
  NavigationRetentionServiceLayer
} from './navigation-retention.service'

const now = new Date('2026-08-08T12:00:00.000Z')
const userId = randomUUID()
const expiredAnonymousSessionId = randomUUID()
const recentAnonymousSessionId = randomUUID()
const expiredUserSessionId = randomUUID()
const sessionIds = [expiredAnonymousSessionId, recentAnonymousSessionId, expiredUserSessionId]

const retentionLayer = NavigationRetentionServiceLayer.pipe(Layer.provide(DatabaseTestLayer))

const sweepExpiredAnonymousSessions = Effect.gen(function* () {
  const retention = yield* NavigationRetentionService
  return yield* retention.sweepExpiredAnonymousSessions(now)
}).pipe(Effect.provide(retentionLayer))

beforeAll(async () => {
  await db.insert(user).values({
    id: userId,
    name: 'Navigation retention test user',
    email: `navigation-retention-${userId}@test.invalid`
  })
  await db.insert(navigationSessions).values([
    {
      id: expiredAnonymousSessionId,
      deviceToken: randomUUID(),
      updatedAt: new Date(now.getTime() - ANONYMOUS_NAVIGATION_SESSION_RETENTION_MS - 1)
    },
    {
      id: recentAnonymousSessionId,
      deviceToken: randomUUID(),
      updatedAt: new Date(now.getTime() - ANONYMOUS_NAVIGATION_SESSION_RETENTION_MS + 1)
    },
    {
      id: expiredUserSessionId,
      userId,
      updatedAt: new Date(now.getTime() - ANONYMOUS_NAVIGATION_SESSION_RETENTION_MS - 1)
    }
  ])
})

afterAll(async () => {
  await db.delete(navigationSessions).where(inArray(navigationSessions.id, sessionIds))
  await db.delete(user).where(eq(user.id, userId))
})

describe('NavigationRetentionService', () => {
  test('deletes only anonymous sessions older than 30 days', async () => {
    const result = await Effect.runPromise(sweepExpiredAnonymousSessions)

    expect(result).toEqual({ deleted: 1 })

    const remaining = await db
      .select({ id: navigationSessions.id })
      .from(navigationSessions)
      .where(inArray(navigationSessions.id, sessionIds))

    expect(remaining.map((session) => session.id).sort()).toEqual(
      [recentAnonymousSessionId, expiredUserSessionId].sort()
    )
  })
})
