import { context, trace } from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { describe, expect, test, vi } from 'vitest'
import { instrumentDatabaseClient } from './database-instrumentation'

describe('instrumentDatabaseClient', () => {
  test('emits a safe span around query config objects and preserves query behavior', async () => {
    const secret = 'secret-user-id'
    const query = vi.fn(async (_queryConfig: unknown) => ({ rows: [{ id: 'audio-1' }] }))
    const spans: unknown[] = []
    const runSpan = <A>(options: unknown, evaluate: () => A): A => {
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
    const query = vi.fn(async (_queryConfig: unknown) => 'ok')
    let spanStarted = false
    const runSpan = <A>(_options: unknown, evaluate: () => A): A => {
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
    const query = vi.fn(async (_queryConfig: unknown) => 'ok')
    let spanCount = 0
    const instrumentation = {
      hasActiveSpan: () => true,
      runSpan: <A>(_options: unknown, evaluate: () => A): A => {
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
    const databaseExporter = new InMemorySpanExporter()
    const databaseProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(databaseExporter)]
    })
    databaseProvider.register()
    const effectExporter = new InMemorySpanExporter()
    const effectProvider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(effectExporter)]
    })

    try {
      const clientQuery = vi.fn(async (_queryConfig: unknown) => 'ok')
      const client = instrumentDatabaseClient({ query: clientQuery })
      const poolQuery = vi.fn(async (queryConfig: unknown) => {
        await Promise.resolve()
        return client.query(queryConfig)
      })
      const pool = instrumentDatabaseClient({ query: poolQuery })
      const requestSpan = effectProvider
        .getTracer('database-instrumentation-test')
        .startSpan('request')

      await context.with(trace.setSpan(context.active(), requestSpan), async () => {
        await pool.query('select "id" from "audio"')
      })
      requestSpan.end()
      await Promise.all([databaseProvider.forceFlush(), effectProvider.forceFlush()])

      const databaseSpans = databaseExporter.getFinishedSpans()
      const databaseSpan = databaseSpans.find((span) => span.name === 'SELECT audio')
      const finishedRequestSpan = effectExporter
        .getFinishedSpans()
        .find((span) => span.name === 'request')

      expect(databaseSpan?.parentSpanContext?.spanId).toBe(
        finishedRequestSpan?.spanContext().spanId
      )
      expect(databaseSpan?.attributes).toMatchObject({
        'sentry.op': 'db.query',
        'db.system.name': 'postgresql',
        'db.operation.name': 'SELECT',
        'db.collection.name': 'audio',
        'db.query.summary': 'SELECT audio'
      })
      expect(databaseSpans.filter((span) => span.name === 'SELECT audio')).toHaveLength(1)
      expect(poolQuery).toHaveBeenCalledOnce()
      expect(clientQuery).toHaveBeenCalledOnce()
    } finally {
      await Promise.all([databaseProvider.shutdown(), effectProvider.shutdown()])
      trace.disable()
    }
  })
})
