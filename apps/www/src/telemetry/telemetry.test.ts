import { describe, expect, test } from 'vitest'

import { createTelemetryBatcher, isSampled } from './browser'
import { decodeBrowserTelemetryBatch, MAX_BODY_BYTES } from './contract'
import { errorFingerprint, routeTemplate } from './privacy'
import { handleBrowserTelemetry, type BrowserTelemetryEnv } from './server'
import { anonymousSession, SESSION_TTL_MS } from './session'

const session = '0123456789abcdef0123456789abcdef'

const event = { kind: 'navigation' as const, name: 'initial-load' as const, route: '/', value: 1 }

const envelope = () => ({
  version: 1,
  session,
  release: 'release-1',
  sampleRate: 0.1,
  sentAt: 1,
  events: [event],
})

describe('privacy boundary', () => {
  test('rejects private fields, raw queries, unknown versions, and unbounded values', () => {
    expect(() => decodeBrowserTelemetryBatch(envelope())).not.toThrow()
    expect(() => decodeBrowserTelemetryBatch({ ...envelope(), version: 2 })).toThrow()
    expect(() =>
      decodeBrowserTelemetryBatch({ ...envelope(), email: 'person@example.com' }),
    ).toThrow()
    expect(() =>
      decodeBrowserTelemetryBatch({
        ...envelope(),
        events: [{ ...event, route: '/mix/private?email=person@example.com' }],
      }),
    ).toThrow()
  })

  test('fingerprints equivalent sensitive errors without transporting messages or stacks', () => {
    const first = errorFingerprint(
      new Error('Failed person@example.com https://example.com/private/123 deadbeef1234'),
      'error',
    )

    const second = errorFingerprint(
      new Error('Failed other@example.net https://other.test/secret/999 feedface5678'),
      'error',
    )

    expect(first).toBe(second)
    expect(first).toMatch(/^error\.[0-9a-f]{8}$/)
    expect(first).not.toContain('person')
    expect(routeTemplate('/mix/[slug]', '/mix/private')).toBe('/mix/[slug]')
    expect(routeTemplate(undefined, '/mix/private')).toBe('/unknown')
  })

  test('rotates the random anonymous session at 24 hours', () => {
    const values = new Map<string, string>()

    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    let next = 0
    const random = () => String(++next).padStart(32, '0')

    expect(anonymousSession(storage, 1_000, random)).toBe('00000000000000000000000000000001')
    expect(anonymousSession(storage, 1_000 + SESSION_TTL_MS - 1, random)).toBe(
      '00000000000000000000000000000001',
    )
    expect(anonymousSession(storage, 1_000 + SESSION_TTL_MS, random)).toBe(
      '00000000000000000000000000000002',
    )
  })
})

describe('batch transport', () => {
  test('batches and uses fetch only when beacon declines', async () => {
    const beacons: Array<string> = []
    const fetches: Array<string> = []
    let scheduled: (() => void) | undefined

    const batcher = createTelemetryBatcher({
      session,
      release: 'release-1',
      transport: {
        beacon: (body) => {
          beacons.push(body)

          return false
        },
        fetch: async (body) => {
          fetches.push(body)
        },
      },
      now: () => 123,
      schedule: (flush) => {
        scheduled = flush
      },
    })

    batcher.add(event)
    batcher.add({ ...event, name: 'spa-navigation' })
    scheduled?.()
    await Promise.resolve()

    expect(beacons).toHaveLength(1)
    expect(fetches).toEqual(beacons)
    expect(JSON.parse(beacons[0] ?? '{}').events).toHaveLength(2)
    expect(isSampled(session, 0)).toBe(false)
    expect(isSampled(session, 1)).toBe(true)
  })
})

describe('Cloudflare ingestion', () => {
  const points: Array<unknown> = []

  const env: BrowserTelemetryEnv = {
    APP_STAGE: 'prod',
    APP_RELEASE: 'release-1',
    BROWSER_TELEMETRY_ORIGIN: 'https://www.goosebumps.fm',
    BROWSER_TELEMETRY: { writeDataPoint: (point) => points.push(point) },
    BROWSER_TELEMETRY_RATE_LIMIT: { limit: async () => ({ success: true }) },
  }

  const request = (body: BodyInit, origin = env.BROWSER_TELEMETRY_ORIGIN) =>
    new Request('https://www.goosebumps.fm/telemetry/browser', {
      method: 'POST',
      body,
      headers: { origin, 'content-type': 'application/json', 'user-agent': 'Firefox/130' },
    })

  test('enforces exact origin and writes only bounded dimensions', async () => {
    expect(
      (await handleBrowserTelemetry(request(JSON.stringify(envelope()), 'https://evil.test'), env))
        .status,
    ).toBe(403)
    expect((await handleBrowserTelemetry(request(JSON.stringify(envelope())), env)).status).toBe(
      204,
    )
    expect(points.at(-1)).toEqual({
      indexes: ['navigation'],
      blobs: ['release-1', 'prod', 'navigation', 'initial-load', '/', 'firefox', session],
      doubles: [1, 0.1],
    })
  })

  test('enforces streamed bytes instead of trusting Content-Length', async () => {
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES))
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      },
    })

    // SAFETY: Node supports this Fetch extension for streamed request bodies.
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      body: oversized,
      duplex: 'half',
      headers: {
        origin: env.BROWSER_TELEMETRY_ORIGIN,
        'content-type': 'application/json',
        'content-length': '1',
      },
    }

    const response = await handleBrowserTelemetry(
      new Request('https://www.goosebumps.fm/telemetry/browser', init),
      env,
    )

    expect(response.status).toBe(413)
  })

  test('rate limits before reading or writing the body', async () => {
    const response = await handleBrowserTelemetry(request(JSON.stringify(envelope())), {
      ...env,
      BROWSER_TELEMETRY_RATE_LIMIT: { limit: async () => ({ success: false }) },
    })

    expect(response.status).toBe(429)
  })
})
