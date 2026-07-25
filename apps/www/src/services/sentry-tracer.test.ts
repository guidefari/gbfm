import * as Effect from 'effect/Effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const started: Array<{ name: string; forceTransaction?: boolean }> = []
const ended: Array<{ name: string; status?: { message: string; code: number } }> = []
const attributesByName = new Map<string, Record<string, unknown>>()

vi.mock('@sentry/react', () => ({
  startInactiveSpan: (options: { name: string; forceTransaction?: boolean }) => {
    started.push({ name: options.name, forceTransaction: options.forceTransaction })
    const record: { name: string; status?: { message: string; code: number } } = {
      name: options.name
    }
    attributesByName.set(options.name, {})
    return {
      spanContext: () => ({ spanId: 'abcdef0123456789', traceId: 'a'.repeat(32) }),
      setAttribute: (key: string, value: unknown) => {
        const bag = attributesByName.get(options.name)
        if (bag) bag[key] = value
      },
      setAttributes: (values: Record<string, unknown>) => {
        const bag = attributesByName.get(options.name)
        if (bag) Object.assign(bag, values)
      },
      setStatus: (status: { message: string; code: number }) => {
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

  it('forwards a successful Effect span to Sentry and ends it as ok', async () => {
    await run(Effect.withSpan('playSpotifyEntity')(Effect.succeed('done')))

    expect(started.map((s) => s.name)).toContain('playSpotifyEntity')
    const record = ended.find((e) => e.name === 'playSpotifyEntity')
    expect(record?.status).toEqual({ message: 'Success', code: 1 })
  })

  it('marks a failed span with an error status and records the cause', async () => {
    await run(Effect.withSpan('queueSpotifyEntity')(Effect.fail('no device')).pipe(Effect.result))

    const record = ended.find((e) => e.name === 'queueSpotifyEntity')
    expect(record?.status?.code).toBe(2)
    expect(attributesByName.get('queueSpotifyEntity')?.['effect.cause']).toContain('no device')
  })

  it('propagates span attributes set inside the effect', async () => {
    await run(
      Effect.withSpan('fetchSpotifyProfile')(Effect.annotateCurrentSpan('entity.kind', 'album'))
    )

    expect(attributesByName.get('fetchSpotifyProfile')?.['entity.kind']).toBe('album')
  })

  it('nests child spans under the parent trace', async () => {
    await run(Effect.withSpan('outer')(Effect.withSpan('inner')(Effect.succeed(1))))

    expect(started.map((s) => s.name)).toEqual(expect.arrayContaining(['outer', 'inner']))
    expect(ended.map((e) => e.name)).toEqual(expect.arrayContaining(['outer', 'inner']))
  })
})
