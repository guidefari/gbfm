import { describe, expect, test, vi } from 'vitest'

import { createTelemetryBatcher, isSampled } from './client'
import { decodeBrowserTelemetryBatch, MAX_BODY_BYTES } from './contract'
import { ingestBrowserTelemetry } from './ingestion'
import { errorFingerprint, routeTemplate } from './privacy'
import { anonymousSession, SESSION_TTL_MS } from './session'

const session = '0123456789abcdef0123456789abcdef'

const event = { kind: 'navigation' as const, name: 'initial-load' as const, route: '/', value: 1 }

const envelope = (events: ReadonlyArray<typeof event> = [event]) => ({
  version: 1,
  session,
  release: 'release-1',
  sampleRate: 0.1,
  sentAt: 1,
  events,
})

describe('browser telemetry contract', () => {
  test('rejects unsupported versions, unknown fields, unbounded names, and raw query routes', () => {
    expect(() => decodeBrowserTelemetryBatch(envelope())).not.toThrow()
    expect(() => decodeBrowserTelemetryBatch({ ...envelope(), version: 2 })).toThrow()
    expect(() => decodeBrowserTelemetryBatch({ ...envelope(), sampleRate: 0 })).toThrow()
    expect(() => decodeBrowserTelemetryBatch({ ...envelope(), userId: 'private' })).toThrow()
    expect(() =>
      decodeBrowserTelemetryBatch({
        ...envelope(),
        events: [{ ...event, name: 'x'.repeat(81) }],
      }),
    ).toThrow()
    expect(() =>
      decodeBrowserTelemetryBatch(envelope([{ ...event, route: '/mix?email=private' }])),
    ).toThrow()
  })
})

describe('privacy', () => {
  test('redacts variable sensitive values before creating a deterministic fingerprint', () => {
    const first = errorFingerprint(
      new Error('Failed for person@example.com at https://example.com/private/123 id deadbeef1234'),
      'error',
    )

    const second = errorFingerprint(
      new Error('Failed for other@example.net at https://another.test/secret/999 id feedface5678'),
      'error',
    )

    expect(first).toBe(second)
    expect(first).toMatch(/^error\.[0-9a-f]{8}$/)
    expect(first).not.toContain('person')
  })

  test('uses route IDs and removes raw high-cardinality path segments', () => {
    expect(routeTemplate('/mix/[slug]', '/mix/private-value')).toBe('/mix/[slug]')
    expect(routeTemplate(null, '/mix/a-private-slug')).toBe('/unknown')
  })
})

describe('anonymous session and sampling', () => {
  test('reuses a session for 24 hours then rotates it', () => {
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

  test('sampling is deterministic and honors boundary rates', () => {
    expect(isSampled(session)).toBe(isSampled(session))
    expect(isSampled(session, 0)).toBe(false)
    expect(isSampled(session, 1)).toBe(true)
  })
})

describe('batch transport', () => {
  test('batches events and falls back to keepalive fetch when beacon declines', async () => {
    const beacon = vi.fn((_body: string) => false)
    const fetch = vi.fn(async () => undefined)
    let scheduled: (() => void) | undefined

    const batcher = createTelemetryBatcher({
      session,
      release: 'release-1',
      transport: { beacon, fetch },
      now: () => 123,
      schedule: (flush) => {
        scheduled = flush

        return 1
      },
    })

    batcher.add(event)
    batcher.add({ ...event, name: 'spa-navigation' })
    expect(beacon).not.toHaveBeenCalled()
    scheduled?.()
    await Promise.resolve()

    expect(beacon).toHaveBeenCalledOnce()
    const body = beacon.mock.calls[0]?.[0]
    expect(body).toBeDefined()
    expect(fetch).toHaveBeenCalledWith(body)
    expect(JSON.parse(body ?? '{}').events).toHaveLength(2)
  })

  test('does not fetch when beacon accepts the batch', () => {
    const fetch = vi.fn(async () => undefined)

    const batcher = createTelemetryBatcher({
      session,
      release: 'release-1',
      transport: { beacon: () => true, fetch },
      schedule: () => 1,
    })

    batcher.add(event)
    batcher.flush()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('browser telemetry ingestion', () => {
  const request = (body: BodyInit, origin = 'https://www.goosebumps.fm') =>
    new Request('https://www.goosebumps.fm/telemetry/browser', {
      method: 'POST',
      body,
      headers: { origin, 'user-agent': 'Firefox/130' },
    })

  test('validates origin and writes bounded dimensions', async () => {
    const points: Array<unknown> = []
    expect(
      (
        await ingestBrowserTelemetry(request(JSON.stringify(envelope()), 'https://evil.test'), {
          stage: 'prod',
          release: 'release-1',
          write: (point) => points.push(point),
        })
      ).status,
    ).toBe(403)

    expect(
      (
        await ingestBrowserTelemetry(request(JSON.stringify(envelope())), {
          stage: 'prod',
          release: 'release-1',
          write: (point) => points.push(point),
        })
      ).status,
    ).toBe(204)
    expect(points).toEqual([
      {
        indexes: ['navigation'],
        blobs: ['release-1', 'prod', 'navigation', 'initial-load', '/', 'firefox', session],
        doubles: [1, 0.1],
      },
    ])
  })

  test('accepts the browser origin when a trusted proxy terminates HTTPS', async () => {
    const proxied = new Request('http://gbfm.localhost/telemetry/browser', {
      method: 'POST',
      body: JSON.stringify(envelope()),
      headers: {
        origin: 'https://gbfm.localhost',
        'user-agent': 'Firefox/130',
        'x-forwarded-proto': 'https',
      },
    })

    expect(
      (
        await ingestBrowserTelemetry(proxied, {
          stage: 'local',
          release: 'release-1',
          write: () => {},
        })
      ).status,
    ).toBe(204)
  })

  test('enforces the bytes read rather than trusting Content-Length', async () => {
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_BODY_BYTES))
        controller.enqueue(new Uint8Array([1]))
        controller.close()
      },
    })

    // SAFETY: Node's Request runtime supports the required `duplex` extension, absent from DOM types.
    const streamed = new Request('https://www.goosebumps.fm/telemetry/browser', {
      method: 'POST',
      body: oversized,
      duplex: 'half',
      headers: { origin: 'https://www.goosebumps.fm', 'content-length': '1' },
    } as RequestInit)

    expect(
      (
        await ingestBrowserTelemetry(streamed, {
          stage: 'test',
          release: 'release-1',
          write: () => {},
        })
      ).status,
    ).toBe(413)
  })

  test('exposes an optional rate-limit seam', async () => {
    const response = await ingestBrowserTelemetry(request(JSON.stringify(envelope())), {
      stage: 'prod',
      release: 'release-1',
      write: () => {},
      allow: () => false,
    })

    expect(response.status).toBe(429)
  })

  test('rejects telemetry stamped with a different deployed release', async () => {
    const response = await ingestBrowserTelemetry(request(JSON.stringify(envelope())), {
      stage: 'prod',
      release: 'release-2',
      write: () => {},
    })

    expect(response.status).toBe(400)
  })
})
