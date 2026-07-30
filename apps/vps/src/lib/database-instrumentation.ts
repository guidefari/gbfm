import * as Sentry from '@sentry/bun'
import { extractDatabaseQueryText, summarizeDatabaseQuery } from './database-telemetry'

const INSTRUMENTED_DATABASE_CLIENT = Symbol('instrumented-database-client')

type DatabaseSpanOptions = {
  readonly name: string
  readonly op: 'db.query'
  readonly attributes: Readonly<Record<string, string>>
}

type DatabaseInstrumentation = {
  readonly hasActiveSpan: () => boolean
  readonly runSpan: <A>(options: DatabaseSpanOptions, evaluate: () => A) => A
}

type QueryableClient = {
  readonly query: unknown
  readonly [INSTRUMENTED_DATABASE_CLIENT]?: true
}

const sentryDatabaseInstrumentation: DatabaseInstrumentation = {
  hasActiveSpan: () => Sentry.getActiveSpan() !== undefined,
  runSpan: (options, evaluate) => Sentry.startSpan(options, evaluate)
}

/**
 * Instruments the concrete pg query boundary without relying on runtime module hooks.
 *
 * Bun does not currently activate Sentry's OpenTelemetry pg patch, so PoolClient
 * instances are wrapped explicitly. Queries without an active trace take the direct
 * path without parsing SQL or creating a span.
 */
export function instrumentDatabaseClient<T extends QueryableClient>(
  client: T,
  instrumentation: DatabaseInstrumentation = sentryDatabaseInstrumentation
): T {
  if (client[INSTRUMENTED_DATABASE_CLIENT] || typeof client.query !== 'function') return client

  const originalQuery = client.query
  const instrumentedQuery = function (
    this: unknown,
    queryConfig: unknown,
    ...arguments_: readonly unknown[]
  ): unknown {
    if (!instrumentation.hasActiveSpan()) {
      return Reflect.apply(originalQuery, this, [queryConfig, ...arguments_])
    }

    const summary = summarizeDatabaseQuery(extractDatabaseQueryText(queryConfig) ?? '')
    return instrumentation.runSpan(
      {
        name: summary.description,
        op: 'db.query',
        attributes: {
          'db.system.name': 'postgresql',
          'db.operation.name': summary.operation,
          'db.collection.name': summary.table,
          'db.query.summary': summary.description
        }
      },
      () => Reflect.apply(originalQuery, this, [queryConfig, ...arguments_])
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
