import { Effect } from 'effect'
import { config } from '@/services/config.service'
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import {
  Pool,
  type QueryArrayConfig,
  type QueryArrayResult,
  type QueryConfig,
  type QueryConfigValues,
  type QueryResult,
  type QueryResultRow,
  type Submittable
} from 'pg'
import {
  getCurrentDbCallerHint,
  getCurrentSignupTraceId,
  toAuthTracingError,
  withSignupRequestParentSpan
} from '@/lib/auth-tracing'

const isProd = config.app.stage === 'prod'

const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  ssl: isProd ? true : { rejectUnauthorized: false }
}
Effect.logInfo('[DB] Connecting to database', {
  stage: config.app.dbStage || 'prod',
  host: dbConfig.host,
  database: dbConfig.database
}).pipe(Effect.runPromise)

const pool = new Pool(dbConfig)

function getQueryText(args: unknown[]) {
  const firstArg = args[0]

  if (typeof firstArg === 'string') {
    return firstArg
  }

  if (
    typeof firstArg === 'object' &&
    firstArg !== null &&
    'text' in firstArg &&
    typeof firstArg.text === 'string'
  ) {
    return firstArg.text
  }

  return 'unknown'
}

function normalizeQueryText(query: string) {
  return query.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function captureCallerHint() {
  if (isProd) {
    return undefined
  }

  const stack = new Error('db-caller-hint').stack
  if (!stack) {
    return undefined
  }

  return stack
    .split('\n')
    .slice(2)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line.startsWith('at ')) return false
      if (line.includes('/db/index.ts')) return false
      if (line.includes('node:internal/')) return false
      if (line.includes('instrumentedQuery')) return false
      return true
    })
    .slice(0, 8)
    .join(' | ')
    .slice(0, 1000)
}

const originalQuery = pool.query.bind(pool)
let runtimePromise: Promise<typeof import('@/runtime')> | undefined

function getRuntime() {
  runtimePromise ??= import('@/runtime')
  return runtimePromise
}

function instrumentedQuery<T extends Submittable>(queryStream: T): T
function instrumentedQuery<
  R extends unknown[] = unknown[],
  I extends unknown[] = unknown[]
>(
  queryConfig: QueryArrayConfig<I>,
  values?: QueryConfigValues<I>
): Promise<QueryArrayResult<R>>
function instrumentedQuery<
  R extends QueryResultRow = QueryResultRow,
  I extends unknown[] = unknown[]
>(queryConfig: QueryConfig<I>): Promise<QueryResult<R>>
function instrumentedQuery<
  R extends QueryResultRow = QueryResultRow,
  I extends unknown[] = unknown[]
>(
  queryTextOrConfig: string | QueryConfig<I>,
  values?: QueryConfigValues<I>
): Promise<QueryResult<R>>
function instrumentedQuery<
  R extends unknown[] = unknown[],
  I extends unknown[] = unknown[]
>(
  queryConfig: QueryArrayConfig<I>,
  callback: (err: Error, result: QueryArrayResult<R>) => void
): void
function instrumentedQuery<
  R extends QueryResultRow = QueryResultRow,
  I extends unknown[] = unknown[]
>(
  queryTextOrConfig: string | QueryConfig<I>,
  callback: (err: Error, result: QueryResult<R>) => void
): void
function instrumentedQuery<
  R extends QueryResultRow = QueryResultRow,
  I extends unknown[] = unknown[]
>(
  queryText: string,
  values: QueryConfigValues<I>,
  callback: (err: Error, result: QueryResult<R>) => void
): void
function instrumentedQuery(
  arg1: Submittable | string | QueryConfig | QueryArrayConfig,
  arg2?:
    | QueryConfigValues<unknown[]>
    | ((err: Error, result: QueryResult) => void),
  arg3?: (err: Error, result: QueryResult) => void
) {
  if (typeof arg2 === 'function') {
    return originalQuery(arg1 as string | QueryConfig, arg2)
  }

  if (arg3) {
    return originalQuery(
      arg1 as string,
      arg2 as QueryConfigValues<unknown[]>,
      arg3
    )
  }

  const traceId = getCurrentSignupTraceId()

  if (!traceId) {
    if (arg2 !== undefined) {
      return originalQuery(
        arg1 as string | QueryConfig | QueryArrayConfig,
        arg2
      )
    }

    return originalQuery(arg1 as Submittable & QueryConfig)
  }

  const queryText = normalizeQueryText(getQueryText([arg1, arg2, arg3]))
  const callerHint = getCurrentDbCallerHint() ?? captureCallerHint()

  const program = Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan('db.pool.total_count', pool.totalCount)
    yield* Effect.annotateCurrentSpan('db.pool.idle_count', pool.idleCount)
    yield* Effect.annotateCurrentSpan(
      'db.pool.waiting_count',
      pool.waitingCount
    )

    const startedAt = performance.now()

    const result = yield* Effect.tryPromise({
      try: () =>
        arg2 !== undefined
          ? originalQuery(arg1 as string | QueryConfig | QueryArrayConfig, arg2)
          : originalQuery(arg1 as QueryConfig | QueryArrayConfig),
      catch: (cause) => toAuthTracingError('db.pg.query', cause)
    })

    yield* Effect.annotateCurrentSpan(
      'db.query.execution_ms',
      Math.round((performance.now() - startedAt) * 100) / 100
    )

    return result
  }).pipe(
    Effect.withSpan('db.pg.query', {
      attributes: {
        'auth.trace_id': traceId,
        'db.system': 'postgresql',
        'db.statement': queryText,
        ...(callerHint ? { 'db.caller_hint': callerHint } : {})
      }
    })
  )

  return getRuntime().then(({ runApp }) =>
    runApp(withSignupRequestParentSpan(program, traceId))
  )
}

pool.query = instrumentedQuery

export { pool }
export const db = drizzle(pool)
