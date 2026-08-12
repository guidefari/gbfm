import { OtelTracer, Resource } from '@effect/opentelemetry'
import { trace } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { Effect, Layer } from 'effect'
import { describe, expect, test, vi } from 'vitest'
import { instrumentDatabaseClient, type DatabaseSpanOptions } from './database-instrumentation'

type TestQueryInput = string | { readonly text: string; readonly values?: readonly string[] }

describe('instrumentDatabaseClient', () => {
  test('emits a safe span around query config objects and preserves query behavior', async () => {
    const secret = 'secret-user-id'
    const query = vi.fn(async (queryConfig: TestQueryInput) => {
      void queryConfig
      return { rows: [{ id: 'audio-1' }] }
    })
    const spans: DatabaseSpanOptions[] = []
    const runSpan = <A>(options: DatabaseSpanOptions, evaluate: () => A): A => {
      spans.push(options)
      return evaluate()
    }
    const client = instrumentDatabaseClient(
      { query },
      {
        hasActiveSpan: () => true,
        runSpan
      }
    )
    const queryConfig = {
      text: 'select "audio"."id" from "audio" where "creatorId" = $1',
      values: [secret]
    }

    await expect(client.query(queryConfig)).resolves.toEqual({ rows: [{ id: 'audio-1' }] })

    expect(query).toHaveBeenCalledWith(queryConfig)
    expect(spans).toEqual([
      {
        name: 'SELECT audio',
        op: 'db.query',
        attributes: {
          'gbfm.db.instrumentation': 'manual',
          'db.system.name': 'postgresql',
          'db.operation.name': 'SELECT',
          'db.collection.name': 'audio',
          'db.query.summary': 'SELECT audio'
        }
      }
    ])
    expect(JSON.stringify(spans)).not.toContain(secret)
  })

  test('takes the direct query path when there is no active request span', async () => {
    const query = vi.fn(async (queryConfig: TestQueryInput) => {
      void queryConfig
      return 'ok'
    })
    let spanStarted = false
    const runSpan = <A>(_options: DatabaseSpanOptions, evaluate: () => A): A => {
      spanStarted = true
      return evaluate()
    }
    const client = instrumentDatabaseClient(
      { query },
      {
        hasActiveSpan: () => false,
        runSpan
      }
    )

    await expect(client.query('select 1')).resolves.toBe('ok')
    expect(spanStarted).toBe(false)
  })

  test('does not wrap a database client more than once', async () => {
    const query = vi.fn(async (queryConfig: TestQueryInput) => {
      void queryConfig
      return 'ok'
    })
    let spanCount = 0
    const instrumentation = {
      hasActiveSpan: () => true,
      runSpan: <A>(_options: DatabaseSpanOptions, evaluate: () => A): A => {
        spanCount += 1
        return evaluate()
      }
    }
    const client = { query }

    instrumentDatabaseClient(client, instrumentation)
    instrumentDatabaseClient(client, instrumentation)

    await expect(client.query('select 1')).resolves.toBe('ok')
    expect(spanCount).toBe(1)
    expect(query).toHaveBeenCalledOnce()
  })

  test('emits one child span when a pool delegates asynchronously to a client', async () => {
    const exporter = new InMemorySpanExporter()
    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)]
    })
    provider.register()
    const tracingLive = OtelTracer.layerGlobal.pipe(
      Layer.provide(Resource.layer({ serviceName: 'database-instrumentation-test' }))
    )

    try {
      const clientQuery = vi.fn(async (queryConfig: TestQueryInput) => {
        void queryConfig
        return 'ok'
      })
      const client = instrumentDatabaseClient({ query: clientQuery })
      const poolQuery = vi.fn(async (queryConfig: TestQueryInput) => {
        await Promise.resolve()
        return client.query(queryConfig)
      })
      const pool = instrumentDatabaseClient({ query: poolQuery })
      await Effect.promise(() => pool.query('select "id" from "audio"')).pipe(
        Effect.withSpan('request'),
        Effect.provide(tracingLive),
        Effect.runPromise
      )
      await provider.forceFlush()

      const spans = exporter.getFinishedSpans()
      const databaseSpan = spans.find((span) => span.name === 'SELECT audio')
      const finishedRequestSpan = spans.find((span) => span.name === 'request')

      expect(databaseSpan?.parentSpanContext?.spanId).toBe(
        finishedRequestSpan?.spanContext().spanId
      )
      expect(databaseSpan?.attributes).toMatchObject({
        'gbfm.db.instrumentation': 'manual',
        'sentry.op': 'db.query',
        'db.system.name': 'postgresql',
        'db.operation.name': 'SELECT',
        'db.collection.name': 'audio',
        'db.query.summary': 'SELECT audio'
      })
      expect(spans.filter((span) => span.name === 'SELECT audio')).toHaveLength(1)
      expect(poolQuery).toHaveBeenCalledOnce()
      expect(clientQuery).toHaveBeenCalledOnce()
    } finally {
      await provider.shutdown()
      trace.disable()
    }
  })
})
