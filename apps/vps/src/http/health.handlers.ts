import { Api } from '@gbfm/api/api'
import { ReadinessCheckFailedError } from '@gbfm/api/errors'
import { sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { Database } from '@/db/layer'

const READINESS_CACHE_MS = 5_000

// Injectable so tests can force the failure path without a real DB outage
// (docs/migration-effect-http-api.md, step 1b noted this gap; step 3a closes it).
// The cause is logged server-side only -- it must never reach the response
// body (a public /health endpoint leaking internal DB error detail is a real
// information-disclosure risk), but it also must not be silently discarded.
export const checkDatabase = Effect.gen(function* () {
  const db = yield* Database
  return yield* Effect.tryPromise({
    try: () => db.execute(sql.raw('SELECT 1')),
    catch: (cause) => cause
  }).pipe(
    Effect.tapError((cause) => Effect.logError('[health] readiness check failed', cause)),
    Effect.mapError(() => new ReadinessCheckFailedError({ dbConnected: false })),
    Effect.asVoid
  )
})

type ReadinessResult = { readonly dbConnected: true } | { readonly dbConnected: false }

// Effect.cachedWithTTL memoizes the *pending* computation, not just its result:
// concurrent requests that arrive while a check is in flight share that one
// fiber instead of each independently hitting the database and racing to
// write a cache slot (the module-level `let` this replaced had that race).
const readinessResult = <R>(check: Effect.Effect<void, ReadinessCheckFailedError, R>) =>
  check.pipe(
    Effect.as<ReadinessResult>({ dbConnected: true }),
    Effect.catch(() => Effect.succeed<ReadinessResult>({ dbConnected: false })),
    Effect.cachedWithTTL(`${READINESS_CACHE_MS} millis`)
  )

const readiness = <R>(cachedCheck: Effect.Effect<ReadinessResult, never, R>) =>
  Effect.gen(function* () {
    const result = yield* cachedCheck
    if (!result.dbConnected) {
      return yield* new ReadinessCheckFailedError({ dbConnected: false })
    }
    return result
  })

export const makeHealthHandlers = <R>(check: Effect.Effect<void, ReadinessCheckFailedError, R>) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const cachedCheck = yield* readinessResult(check)

      return HttpApiBuilder.group(Api, 'health', (handlers) =>
        handlers
          .handle('live', () => Effect.succeed({ ok: true as const }))
          .handle('ready', () => readiness(cachedCheck))
          .handle('check', () => readiness(cachedCheck))
      )
    })
  )

export const HealthHandlersLive = makeHealthHandlers(checkDatabase)
