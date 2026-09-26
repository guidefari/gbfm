import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { apiSql, browserSql, parseApiResponse, parseBrowserResponse } from './analytics'
import { evaluate, type Metric } from './domain'
import {
  persistAndNotify,
  runDrill,
  type AlertConfig,
  type EmailMessage,
  type KvStore,
} from './runtime'

const config: AlertConfig = {
  release: 'immutable-release-1',
  environment: 'staging',
  fromEmail: 'alerts@example.com',
  fromName: 'GBFM Alerts',
  toEmail: 'oncall@example.com',
  investigationUrl: 'https://dash.cloudflare.com/example',
}

const harness = () => {
  const values = new Map<string, string>()
  const messages: Array<EmailMessage> = []

  const kv: KvStore = {
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => {
      values.set(key, value)
    },
  }

  const email = {
    send: async (message: EmailMessage) => {
      messages.push(message)

      return { messageId: `message-${messages.length}` }
    },
  }

  return { values, messages, kv, email }
}

const burning: Metric = {
  signal: 'availability',
  status: 'burning',
  value: 99,
  threshold: 99.5,
  samples: 100,
  minimumSamples: 100,
  unit: 'percent',
}

describe('Analytics Engine queries', () => {
  it('uses separate sampling-aware datasets and only bounded dimensions', () => {
    const api = apiSql('api_requests', 'immutable-release-1', 'prod', 15)
    const browser = browserSql('browser_events', 'immutable-release-1', 'prod', 15)
    expect(api).toContain('FROM api_requests')
    expect(api).toContain('quantileWeighted(double1, _sample_interval, 0.95)')
    expect(api).toContain("blob4 NOT LIKE '/health/%'")
    expect(api).toContain("blob2 = 'prod'")
    expect(browser).toContain('FROM browser_events')
    expect(browser).toContain('sum(_sample_interval / double2) AS samples')
    expect(browser).toContain("blob4 IN ('lcp', 'inp', 'cls')")
    expect(`${api}${browser}`).not.toMatch(/url|query|user|email/i)
    expect(() => apiSql('bad; DROP TABLE', 'release', 'prod', 15)).toThrow()
  })

  it('decodes numeric strings and rejects malformed rows', async () => {
    await expect(
      Effect.runPromise(
        parseApiResponse({
          data: [{ eligible: '100', successful: 99.5, samples: '100', p95: '900' }],
        }),
      ),
    ).resolves.toMatchObject({ data: [{ p95: 900 }] })
    await expect(
      Effect.runPromise(parseBrowserResponse({ data: [{ vital: 'url', samples: 1, p75: 1 }] })),
    ).rejects.toBeDefined()
  })
})

describe('evaluation and scheduled runtime', () => {
  it('treats exact provisional boundaries as healthy and values beyond them as burning', () => {
    const boundary = {
      eligible: 200,
      successful: 199,
      apiSamples: 100,
      apiP95: 1_000,
      lcpSamples: 75,
      lcpP75: 2_500,
      inpSamples: 75,
      inpP75: 200,
      clsSamples: 75,
      clsP75: 0.1,
    }

    expect(
      evaluate(boundary)
        .slice(0, 5)
        .map(({ status }) => status),
    ).toEqual(['healthy', 'healthy', 'healthy', 'healthy', 'healthy'])

    expect(
      evaluate({
        ...boundary,
        successful: 198,
        apiP95: 1_001,
        lcpP75: 2_501,
        inpP75: 201,
        clsP75: 0.101,
      })
        .slice(0, 5)
        .map(({ status }) => status),
    ).toEqual(['burning', 'burning', 'burning', 'burning', 'burning'])
  })

  it('gates provisional objectives when each signal is below minimum volume', () => {
    const metrics = evaluate({
      eligible: 99,
      successful: 0,
      apiSamples: 99,
      apiP95: 9_999,
      lcpSamples: 74,
      lcpP75: 9_999,
      inpSamples: 74,
      inpP75: 9_999,
      clsSamples: 74,
      clsP75: 1,
    })

    expect(metrics.slice(0, 5).every(({ status }) => status === 'insufficient-volume')).toBe(true)
  })

  it('detects query failure and complete silence', () => {
    expect(evaluate('query-failure').every(({ status }) => status === 'ingestion-failure')).toBe(
      true,
    )

    const silence = evaluate({
      eligible: 0,
      successful: 0,
      apiSamples: 0,
      apiP95: 0,
      lcpSamples: 0,
      lcpP75: 0,
      inpSamples: 0,
      inpP75: 0,
      clsSamples: 0,
      clsP75: 0,
    })

    expect(silence.every(({ status }) => status === 'telemetry-silence')).toBe(true)
  })

  it('sends one pipeline notification for an ingestion failure rather than one per objective', async () => {
    const h = harness()

    await Effect.runPromise(
      persistAndNotify(h.kv, h.email, evaluate('query-failure'), 'failure-1', config),
    )

    expect(h.messages.map(({ subject }) => subject)).toEqual([
      '[FIRING] GBFM telemetry-pipeline (staging)',
    ])
  })

  it('persists per-signal state, deduplicates, then sends an actionable resolution', async () => {
    const h = harness()
    await Effect.runPromise(persistAndNotify(h.kv, h.email, [burning], 'run-1', config))
    await Effect.runPromise(persistAndNotify(h.kv, h.email, [burning], 'run-2', config))
    await Effect.runPromise(
      persistAndNotify(
        h.kv,
        h.email,
        [{ ...burning, status: 'healthy', value: 100 }],
        'run-3',
        config,
      ),
    )
    expect(h.messages.map(({ subject }) => subject)).toEqual([
      '[FIRING] GBFM availability (staging)',
      '[RESOLVED] GBFM availability (staging)',
    ])
    expect(h.messages[0]).toMatchObject({
      from: { email: 'alerts@example.com', name: 'GBFM Alerts' },
      to: 'oncall@example.com',
    })
    expect(h.messages[0]?.text).toContain('Investigate: https://dash.cloudflare.com/example')
    expect(h.values.get('slo:availability')).toBe('{"active":false}')
  })

  it('drills fire then resolve on isolated state and is inert in production', async () => {
    const h = harness()
    await Effect.runPromise(runDrill(h.kv, h.email, 'drill-1', config))
    await Effect.runPromise(runDrill(h.kv, h.email, 'drill-duplicate', config))
    expect(h.messages.map(({ subject }) => subject)).toEqual([
      '[FIRING] GBFM availability (staging)',
      '[RESOLVED] GBFM availability (staging)',
    ])
    expect([...h.values.keys()]).toEqual([
      'drill:slo:availability',
      'drill:completed:immutable-release-1',
    ])
    const production = harness()
    await Effect.runPromise(
      runDrill(production.kv, production.email, 'drill-2', {
        ...config,
        environment: 'prod',
      }),
    )
    expect(production.messages).toEqual([])
    expect(production.values.size).toBe(0)
  })
})
