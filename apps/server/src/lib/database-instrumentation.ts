import { SpanStatusCode, trace } from '@opentelemetry/api'
import { AsyncLocalStorage } from 'node:async_hooks'
import { extractDatabaseQueryText, summarizeDatabaseQuery } from './database-telemetry'

const INSTRUMENTED_DATABASE_CLIENT = Symbol('instrumented-database-client')
const activeDatabaseQuery = new AsyncLocalStorage<boolean>()

type DatabaseSpanOptions = {
  readonly name: string
  readonly op: 'db.query'
  readonly attributes: Readonly<Record<string, string>>
}

type DatabaseInstrumentation = {
  readonly hasActiveSpan: () => boolean
  readonly runSpan: (options: DatabaseSpanOptions, evaluate: () => unknown) => unknown
}

type QueryableClient = {
  readonly query: unknown
  readonly [INSTRUMENTED_DATABASE_CLIENT]?: true
}

const databaseTracer = trace.getTracer('gbfm.database')

function runOpenTelemetrySpan(options: DatabaseSpanOptions, evaluate: () => unknown): unknown {
  return databaseTracer.startActiveSpan(
    options.name,
    {
      attributes: {
        ...options.attributes,
        'sentry.op': options.op
      }
    },
    (span) => {
      let result: unknown
      try {
        result = evaluate()
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR })
        span.end()
        throw error
      }

      if (
        typeof result === 'object' &&
        result !== null &&
        'then' in result &&
        typeof result.then === 'function'
      ) {
        return Promise.resolve(result).then(
          (value) => {
            span.end()
            return value
          },
          (error) => {
            span.setStatus({ code: SpanStatusCode.ERROR })
            span.end()
            throw error
          }
        )
      }

      span.end()
      return result
    }
  )
}

const openTelemetryDatabaseInstrumentation: DatabaseInstrumentation = {
  hasActiveSpan: () => trace.getActiveSpan()?.isRecording() === true,
  runSpan: runOpenTelemetrySpan
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
  instrumentation: DatabaseInstrumentation = openTelemetryDatabaseInstrumentation
): T {
  if (client[INSTRUMENTED_DATABASE_CLIENT] || typeof client.query !== 'function') return client

  const originalQuery = client.query
  const instrumentedQuery = function (
    this: unknown,
    queryConfig: unknown,
    ...arguments_: readonly unknown[]
  ): unknown {
    if (activeDatabaseQuery.getStore() || !instrumentation.hasActiveSpan()) {
      return Reflect.apply(originalQuery, this, [queryConfig, ...arguments_])
    }

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
          'db.query.summary': summary.description
        }
      },
      () =>
        activeDatabaseQuery.run(true, () =>
          Reflect.apply(originalQuery, this, [queryConfig, ...arguments_])
        )
    )
  }

  Object.defineProperties(client, {
    query: {
      configurable: true,
      value: instrumentedQuery,
      writable: true
    },
    [INSTRUMENTED_DATABASE_CLIENT]: {
      value: true
    }
  })

  return client
}
