import { AsyncLocalStorage } from 'node:async_hooks'
import { isPromise } from 'node:util/types'

import { SpanStatusCode, trace } from '@opentelemetry/api'

import { extractDatabaseQueryText, summarizeDatabaseQuery } from './database-telemetry'

const INSTRUMENTED_DATABASE_CLIENT = Symbol('instrumented-database-client')

const activeDatabaseQuery = new AsyncLocalStorage<boolean>()

export type DatabaseSpanOptions = {
  readonly name: string
  readonly op: 'db.query'
  readonly attributes: Readonly<Record<string, string>>
}

type DatabaseInstrumentation = {
  readonly hasActiveSpan: () => boolean
  readonly runSpan: (options: DatabaseSpanOptions, evaluate: () => QueryResult) => QueryResult
}

type QueryResult = object | string | number | boolean | bigint | symbol | null | undefined

type QueryFunction = (...arguments_: Array<never>) => QueryResult

type QueryableClient = {
  readonly query: QueryFunction
  readonly [INSTRUMENTED_DATABASE_CLIENT]?: true
}

const databaseTracer = trace.getTracer('gbfm.database')

function runOpenTelemetrySpan(
  options: DatabaseSpanOptions,
  evaluate: () => QueryResult,
): QueryResult {
  return databaseTracer.startActiveSpan(
    options.name,
    {
      attributes: {
        ...options.attributes,
        'sentry.op': options.op,
      },
    },
    (span): QueryResult => {
      let result: QueryResult

      try {
        result = evaluate()
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR })
        span.end()
        throw error
      }

      if (isPromise(result)) {
        return Promise.resolve(result).then(
          (value) => {
            span.end()

            return value
          },
          (error) => {
            span.setStatus({ code: SpanStatusCode.ERROR })
            span.end()
            throw error
          },
        )
      }

      span.end()

      return result
    },
  )
}

const openTelemetryDatabaseInstrumentation: DatabaseInstrumentation = {
  hasActiveSpan: () => trace.getActiveSpan()?.isRecording() === true,
  runSpan: runOpenTelemetrySpan,
}

/**
 * Instruments the concrete pg query boundary without relying on runtime module hooks.
 *
 * Bun does not currently activate Sentry's OpenTelemetry pg patch, so Pool and
 * PoolClient instances are wrapped explicitly. The Pool boundary preserves Effect's
 * active context before pg switches to its callback internals. Async-local re-entry
 * protection prevents the PoolClient call delegated by Pool.query from creating a
 * duplicate span. Queries without a recording trace take the direct path.
 */
export function instrumentDatabaseClient<T extends QueryableClient>(
  client: T,
  instrumentation: DatabaseInstrumentation = openTelemetryDatabaseInstrumentation,
): T {
  if (client[INSTRUMENTED_DATABASE_CLIENT]) return client

  const originalQuery = client.query.bind(client)

  const instrumentedQuery = function (this: T, ...arguments_: Parameters<T['query']>): QueryResult {
    if (activeDatabaseQuery.getStore() || !instrumentation.hasActiveSpan()) {
      return originalQuery(...arguments_)
    }

    const queryConfig = arguments_[0]
    const summary = summarizeDatabaseQuery(extractDatabaseQueryText(queryConfig) ?? '')

    return instrumentation.runSpan(
      {
        name: summary.description,
        op: 'db.query',
        attributes: {
          'gbfm.db.instrumentation': 'manual',
          'db.system.name': 'postgresql',
          'db.operation.name': summary.operation,
          'db.collection.name': summary.table,
          'db.query.summary': summary.description,
        },
      },
      () => activeDatabaseQuery.run(true, () => originalQuery(...arguments_)),
    )
  }

  Object.defineProperties(client, {
    query: {
      configurable: true,
      value: instrumentedQuery,
      writable: true,
    },
    [INSTRUMENTED_DATABASE_CLIENT]: {
      value: true,
    },
  })

  return client
}
