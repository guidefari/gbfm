import { Api } from '@gbfm/api/api'
import { ReadinessCheckFailedError } from '@gbfm/api/errors'
import type { HealthLiveResponse, HealthReadyResponse } from '@gbfm/api/health'
import { sql } from 'drizzle-orm'
import { Clock, Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { db } from '@/db'

const READINESS_CACHE_MS = 5_000

type ReadinessStatus = 200 | 500
type ReadinessCache = { readonly checkedAt: number; readonly status: ReadinessStatus }

export interface HealthDatabase {
  readonly check: Effect.Effect<void, ReadinessCheckFailedError>
}

const liveResponse = (): HealthLiveResponse => ({ ok: true })
const readyResponse = (): HealthReadyResponse => ({ dbConnected: true })

const readinessFailure = () => new ReadinessCheckFailedError({ dbConnected: false })

const readinessCacheValue = (checkedAt: number, status: ReadinessStatus): ReadinessCache => ({
  checkedAt,
  status
})

const cachedReadinessResponse = (status: ReadinessStatus) =>
  status === 200 ? Effect.succeed(readyResponse()) : Effect.fail(readinessFailure())

export const HealthDatabaseLive: HealthDatabase = {
  check: Effect.tryPromise({
    try: () => db.execute(sql.raw('SELECT 1')),
    catch: () => readinessFailure()
  }).pipe(Effect.asVoid)
}

const makeReadinessResponse = (healthDatabase: HealthDatabase) => {
  let readinessCache: ReadinessCache | undefined

  return Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    const cache = readinessCache

    if (cache && now - cache.checkedAt < READINESS_CACHE_MS) {
      return yield* cachedReadinessResponse(cache.status)
    }

    return yield* Effect.matchEffect(healthDatabase.check, {
      onFailure: (error) =>
        Effect.sync(() => {
          readinessCache = readinessCacheValue(now, 500)
        }).pipe(Effect.flatMap(() => Effect.fail(error))),
      onSuccess: () =>
        Effect.sync(() => {
          readinessCache = readinessCacheValue(now, 200)
        }).pipe(Effect.as(readyResponse()))
    })
  })
}

export const makeHealthHandlers = (healthDatabase: HealthDatabase) => {
  const readinessResponse = makeReadinessResponse(healthDatabase)

  return HttpApiBuilder.group(Api, 'health', (handlers) =>
    handlers
      .handle('live', () => Effect.succeed(liveResponse()))
      .handle('ready', () => readinessResponse)
      .handle('check', () => readinessResponse)
  )
}

export const HealthHandlersLive = makeHealthHandlers(HealthDatabaseLive)
