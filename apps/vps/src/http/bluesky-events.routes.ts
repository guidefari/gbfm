import { and, eq } from 'drizzle-orm'
import { Effect, Schedule, Stream } from 'effect'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http'
import { db } from '@/db'
import { blueskySyncRuns, externalAccounts } from '@/db/external-account.schema'
import { auth } from '@/lib/auth'

type SyncRunStatus = 'running' | 'succeeded' | 'failed'

const terminalStatuses = new Set<SyncRunStatus>(['succeeded', 'failed'])

const toEvent = (row: {
  readonly id: string
  readonly status: SyncRunStatus
  readonly discovered: number
  readonly qualifying: number
  readonly created: number
  readonly alreadyImported: number
  readonly conflicted: number
  readonly failed: number
  readonly skipped: number
  readonly unresolved: number
  readonly pageCount: number
  readonly errorCategory: string | null
  readonly startedAt: Date
  readonly finishedAt: Date | null
}) => ({
  runId: row.id,
  status: row.status,
  discovered: row.discovered,
  qualifying: row.qualifying,
  created: row.created,
  alreadyImported: row.alreadyImported,
  conflicted: row.conflicted,
  failed: row.failed,
  skipped: row.skipped,
  unresolved: row.unresolved,
  pageCount: row.pageCount,
  errorCategory: row.errorCategory,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null
})

const unauthorized = HttpServerResponse.text('Unauthorized', { status: 401 })

export const BlueskyEventsRoute = HttpRouter.add(
  'GET',
  '/api/integrations/bluesky/:accountId/sync/:runId/events',
  HttpRouter.params.pipe(
    Effect.flatMap(({ accountId, runId }) =>
      Effect.gen(function* () {
        if (!accountId || !runId)
          return HttpServerResponse.text('Missing sync identifiers', { status: 400 })
        const request = yield* HttpServerRequest.HttpServerRequest
        const session = yield* Effect.tryPromise({
          try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
          catch: () => null
        })
        if (!session) return unauthorized

        const load = Effect.tryPromise({
          try: async () => {
            const [row] = await db
              .select({
                id: blueskySyncRuns.id,
                status: blueskySyncRuns.status,
                discovered: blueskySyncRuns.discovered,
                qualifying: blueskySyncRuns.qualifying,
                created: blueskySyncRuns.created,
                alreadyImported: blueskySyncRuns.alreadyImported,
                conflicted: blueskySyncRuns.conflicted,
                failed: blueskySyncRuns.failed,
                skipped: blueskySyncRuns.skipped,
                unresolved: blueskySyncRuns.unresolved,
                pageCount: blueskySyncRuns.pageCount,
                errorCategory: blueskySyncRuns.errorCategory,
                startedAt: blueskySyncRuns.startedAt,
                finishedAt: blueskySyncRuns.finishedAt
              })
              .from(blueskySyncRuns)
              .innerJoin(
                externalAccounts,
                eq(externalAccounts.id, blueskySyncRuns.externalAccountId)
              )
              .where(
                and(
                  eq(externalAccounts.id, accountId),
                  eq(externalAccounts.userId, session.user.id),
                  eq(blueskySyncRuns.id, runId)
                )
              )
              .limit(1)
            return row
          },
          catch: () => null
        })

        const initial = yield* load
        if (!initial) return HttpServerResponse.text('Not found', { status: 404 })

        const stream = Stream.concat(
          Stream.succeed(new TextEncoder().encode('retry: 3000\n\n')),
          Stream.fromEffect(load).pipe(
            Stream.filter((row): row is NonNullable<typeof row> => row !== null),
            Stream.map(toEvent),
            Stream.repeat(Schedule.spaced('1 second')),
            Stream.takeUntil((event) => terminalStatuses.has(event.status)),
            Stream.map((event) => {
              const eventName =
                event.status === 'succeeded' ? 'done' : event.status === 'failed' ? 'fatal' : 'sync'
              return new TextEncoder().encode(
                `event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`
              )
            })
          )
        )

        return HttpServerResponse.stream(stream, {
          contentType: 'text/event-stream',
          headers: {
            'cache-control': 'no-cache, no-transform',
            connection: 'keep-alive',
            'x-accel-buffering': 'no'
          }
        })
      })
    )
  )
)
