import { Context, Effect, Layer } from 'effect'
import { pool } from '@/db'
import { DatabaseError, LockUnavailable } from '@/errors'

export interface LockService {
  readonly withLock: <A, E, R>(
    key: string,
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | LockUnavailable | DatabaseError, R>
}

export const LockService = Context.Service<LockService>('LockService')

const databaseError = (operation: string) =>
  new DatabaseError({ message: 'Lock database operation failed', operation })

const withLock = <A, E, R>(
  key: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | LockUnavailable | DatabaseError, R> =>
  Effect.acquireUseRelease(
    Effect.tryPromise({
      try: () => pool.connect(),
      catch: () => databaseError('acquire-lock-connection')
    }),
    (client) =>
      Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: async () => {
            const response = await client.query<{ locked: boolean }>(
              'select pg_try_advisory_lock(hashtext($1)) as locked',
              [key]
            )
            return response.rows[0]?.locked === true
          },
          catch: () => databaseError('acquire-lock')
        })
        if (!result) return yield* new LockUnavailable({ key })
        return yield* effect
      }),
    (client) =>
      Effect.promise(async () => {
        try {
          await client.query('select pg_advisory_unlock(hashtext($1))', [key])
        } finally {
          client.release()
        }
      })
  )

export const LockServiceLayer = Layer.succeed(LockService, { withLock })
