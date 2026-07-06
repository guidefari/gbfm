import { Api } from '@gbfm/api/api'
import { ReadinessCheckFailedError } from '@gbfm/api/errors'
import type { HealthLiveResponse, HealthReadyResponse } from '@gbfm/api/health'
import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/unstable/httpapi'
import { db } from '@/db'

const READINESS_CACHE_MS = 5_000

let readinessCache: { checkedAt: number; status: 200 | 500 } | undefined

const healthCheckEffect = Effect.tryPromise({
  try: () => db.execute(sql.raw('SELECT 1')),
  catch: () => new ReadinessCheckFailedError({ dbConnected: false })
})

const liveResponse = (): HealthLiveResponse => ({ ok: true })
const readyResponse = (): HealthReadyResponse => ({ dbConnected: true })

const readinessFailure = () => new ReadinessCheckFailedError({ dbConnected: false })

const cachedReadinessResponse = (status: 200 | 500) =>
  status === 200 ? Effect.succeed(readyResponse()) : Effect.fail(readinessFailure())

const readinessResponse = Effect.gen(function* () {
  const cache = readinessCache

  if (cache && Date.now() - cache.checkedAt < READINESS_CACHE_MS) {
    return yield* cachedReadinessResponse(cache.status)
  }

  return yield* Effect.matchEffect(healthCheckEffect, {
    onFailure: (error) =>
      Effect.sync(() => {
        readinessCache = { checkedAt: Date.now(), status: 500 }
      }).pipe(Effect.flatMap(() => Effect.fail(error))),
    onSuccess: () =>
      Effect.sync(() => {
        readinessCache = { checkedAt: Date.now(), status: 200 }
      }).pipe(Effect.as(readyResponse()))
  })
})

export const HealthHandlers = HttpApiBuilder.group(Api, 'health', (handlers) =>
  handlers
    .handle('live', () => Effect.succeed(liveResponse()))
    .handle('ready', () => readinessResponse)
    .handle('check', () => readinessResponse)
)
