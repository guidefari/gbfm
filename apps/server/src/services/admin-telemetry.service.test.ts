import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { withTestLayer } from '@/test/effect'

import {
  AdminTelemetryService,
  AdminTelemetryServiceLive,
  AnalyticsEngineConfig,
  telemetrySectionSql,
} from './admin-telemetry.service'

const config = {
  accountId: 'account-1',
  apiToken: 'secret-token',
  dataset: 'browser_events',
}

const delegatedFetch: typeof fetch = Object.assign(
  (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    globalThis.fetch(input, init),
  {
    preconnect: (...args: Parameters<typeof fetch.preconnect>) =>
      globalThis.fetch.preconnect(...args),
  },
)

const live = AdminTelemetryServiceLive.pipe(
  Layer.provide(Layer.succeed(AnalyticsEngineConfig, config)),
  Layer.provide(
    FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, delegatedFetch))),
  ),
)

const dashboard = withTestLayer(
  Effect.gen(function* () {
    return yield* (yield* AdminTelemetryService).dashboard
  }),
  live,
)

afterEach(() => vi.unstubAllGlobals())

describe('admin telemetry query service', () => {
  test.each(['webVitals', 'navigation', 'errors', 'player'] as const)(
    'builds a weighted, bounded %s query over the ingestion dimensions',
    (section) => {
      const sql = telemetrySectionSql('browser_events', section)

      expect(sql).toContain('sum(_sample_interval / double2) AS samples')
      expect(sql).toContain('GROUP BY blob4, blob5, blob1, blob6')
      expect(sql).toContain('LIMIT 20')
      expect(sql).toContain("INTERVAL '24' HOUR")

      expect(sql.includes('quantileWeighted(double1, _sample_interval / double2, 0.75)')).toBe(
        section === 'webVitals' || section === 'navigation',
      )
    },
  )

  test('rejects an unsafe dataset identifier before issuing a request', () => {
    expect(() => telemetrySectionSql('events; DROP TABLE events', 'errors')).toThrow()
  })

  test('returns independently calculated weighted fixture aggregates unchanged', async () => {
    // Raw fixture intervals [2, 3] represent 5 events; the independently calculated
    // weighted p75 for values [100, 400] is 400.
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        data: [
          {
            name: 'lcp',
            route: '/mix/[id]',
            release: 'release-42',
            browser: 'chrome',
            samples: 5,
            p75: 400,
          },
        ],
      }),
    )

    vi.stubGlobal('fetch', fetch)

    const result = await Effect.runPromise(dashboard)

    expect(result.state).toBe('complete')
    expect(result.sections.webVitals.rows[0]).toEqual({
      name: 'lcp',
      route: '/mix/[id]',
      release: 'release-42',
      browser: 'chrome',
      samples: 5,
      p75: 400,
    })
    expect(fetch).toHaveBeenCalledTimes(4)
    const [input, init] = fetch.mock.calls[0]!
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret-token')
    expect(input).toEqual(
      expect.objectContaining({
        href: expect.stringContaining('/accounts/account-1/analytics_engine/sql'),
      }),
    )
  })

  test('marks only failed query sections unavailable without leaking the failure', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1

        return calls === 2
          ? new Response('provider details', { status: 503 })
          : Response.json({ data: [] })
      }),
    )

    const result = await Effect.runPromise(dashboard)

    expect(result.state).toBe('partial')
    expect(Object.values(result.sections).filter((section) => !section.available)).toHaveLength(1)
    expect(JSON.stringify(result)).not.toContain('provider details')
  })
})
