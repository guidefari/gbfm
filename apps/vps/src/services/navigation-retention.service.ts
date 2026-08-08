import { and, isNull, lt } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { navigationSessions } from '@/db/navigation.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { Database } from '@/db/layer'

export const ANONYMOUS_NAVIGATION_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export interface NavigationRetentionService {
  readonly sweepExpiredAnonymousSessions: (
    now: Date
  ) => Effect.Effect<{ readonly deleted: number }, DatabaseError>
}

export const NavigationRetentionService = Context.Service<NavigationRetentionService>(
  'NavigationRetentionService'
)

const cutoffAt = (now: Date) => new Date(now.getTime() - ANONYMOUS_NAVIGATION_SESSION_RETENTION_MS)

export const NavigationRetentionServiceLayer = Layer.effect(
  NavigationRetentionService,
  Effect.gen(function* () {
    const db = yield* Database

    return {
      sweepExpiredAnonymousSessions: (now) =>
        Effect.tryPromise({
          try: async () => {
            const deleted = await db
              .delete(navigationSessions)
              .where(
                and(
                  isNull(navigationSessions.userId),
                  lt(navigationSessions.updatedAt, cutoffAt(now))
                )
              )
              .returning({ id: navigationSessions.id })

            return { deleted: deleted.length }
          },
          catch: (error) =>
            new DatabaseError({
              message: `Failed to sweep expired anonymous navigation sessions: ${getErrorMessage(error)}`,
              operation: 'delete',
              table: 'navigation_sessions'
            })
        })
    }
  })
)
