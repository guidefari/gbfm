import * as Effect from 'effect/Effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const started: Array<{ name: string; forceTransaction?: boolean }> = []
interface SpanStatusRecord {
  message: string
  code: number
}
interface EndedSpanRecord {
  name: string
  status?: SpanStatusRecord
}
type SentryAttribute = string | number | boolean
const ended: EndedSpanRecord[] = []
const attributesByName = new Map<string, Record<string, SentryAttribute>>()

vi.mock('@sentry/react', () => ({
  startInactiveSpan: (options: { name: string; forceTransaction?: boolean }) => {
    started.push({ name: options.name, forceTransaction: options.forceTransaction })
    const record: EndedSpanRecord = {
      name: options.name
    }
    attributesByName.set(options.name, {})
    return {
      spanContext: () => ({ spanId: 'abcdef0123456789' }),
      setAttribute: (key: string, value: SentryAttribute) => {
        const bag = attributesByName.get(options.name)
        if (bag) bag[key] = value
      },
      setAttributes: (values: Record<string, SentryAttribute>) => {
        const bag = attributesByName.get(options.name)
        if (bag) Object.assign(bag, values)
      },
      setStatus: (status: SpanStatusRecord) => {
        record.status = status
      },
      end: () => {
        ended.push(record)
      }
    }
  },
  addBreadcrumb: () => {}
}))

const { SentryTracerLive } = await import('./sentry-tracer')

const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(Effect.provide(effect, SentryTracerLive))

describe('SentryTracerLive', () => {
  beforeEach(() => {
    started.length = 0
    ended.length = 0
    attributesByName.clear()
  })

  it('mirrors successful Effect spans, attributes, and completion status to Sentry', async () => {
    await run(
      Effect.withSpan('playSpotifyEntity')(Effect.annotateCurrentSpan('entity.kind', 'album'))
    )

    expect(started.map((s) => s.name)).toContain('playSpotifyEntity')
    const record = ended.find((e) => e.name === 'playSpotifyEntity')
    expect(record?.status).toEqual({ message: 'Success', code: 1 })
    expect(attributesByName.get('playSpotifyEntity')?.['entity.kind']).toBe('album')

    const traceIds = await run(
      Effect.withSpan('outer')(
        Effect.gen(function* () {
          const outer = yield* Effect.currentSpan
          const inner = yield* Effect.withSpan('inner')(Effect.currentSpan)
          return { outer: outer.traceId, inner: inner.traceId }
        })
      )
    )
    expect(traceIds).toEqual({
      outer: expect.stringMatching(/^[a-f0-9]{32}$/),
      inner: expect.stringMatching(/^[a-f0-9]{32}$/)
    })
    expect(traceIds.inner).toBe(traceIds.outer)
  })

  it('marks a failed span with an error status and records the cause', async () => {
    await run(Effect.withSpan('queueSpotifyEntity')(Effect.fail('no device')).pipe(Effect.result))

    const record = ended.find((e) => e.name === 'queueSpotifyEntity')
    expect(record?.status?.code).toBe(2)
    expect(attributesByName.get('queueSpotifyEntity')?.['effect.cause']).toContain('no device')
  })
})
