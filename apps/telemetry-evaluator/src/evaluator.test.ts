import { Effect, Predicate, Result } from 'effect'
import { HttpClient, HttpClientError, HttpClientResponse } from 'effect/http'
import { describe, expect, it } from 'vitest'

import { apiSql, browserSql, parseApiResponse, parseBrowserResponse, querySlos } from './analytics'
import { evaluate, type Metric } from './domain'
import { renderNotification } from './notification'
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
  windowMinutes: 15,
}

const empty = {
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
    expect(api).toContain('quantileWeighted(0.95, double1, _sample_interval)')
    expect(api).toContain("blob4 NOT LIKE '/health/%'")
    expect(api).toContain("blob2 = 'prod'")
    expect(browser).toContain('FROM browser_events')
    expect(browser).toContain('sum(_sample_interval / double2) AS samples')
    expect(browser).toContain(
      'quantileWeighted(0.75, double1, toUInt32(_sample_interval / double2))',
    )
    expect(browser).toContain("blob4 IN ('lcp', 'inp', 'cls')")

    for (const phrase of ['url', 'query', 'user', 'email'])
      expect(`${api}${browser}`.toLowerCase()).not.toContain(phrase)
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
      evaluate(Result.succeed(boundary))
        .slice(0, 5)
        .map(({ status }) => status),
    ).toEqual(['healthy', 'healthy', 'healthy', 'healthy', 'healthy'])

    expect(
      evaluate(
        Result.succeed({
          ...boundary,
          successful: 198,
          apiP95: 1_001,
          lcpP75: 2_501,
          inpP75: 201,
          clsP75: 0.101,
        }),
      )
        .slice(0, 5)
        .map(({ status }) => status),
    ).toEqual(['burning', 'burning', 'burning', 'burning', 'burning'])
  })

  it('gates provisional objectives when each signal is below minimum volume', () => {
    const metrics = evaluate(
      Result.succeed({
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
      }),
    )

    expect(metrics.slice(0, 5).every(({ status }) => status === 'insufficient-volume')).toBe(true)
  })

  it('detects query failure and complete silence', () => {
    expect(
      evaluate(Result.fail({ reason: 'network', dataset: 'api' })).every(
        ({ status }) => status === 'query-failure',
      ),
    ).toBe(true)

    const silence = evaluate(
      Result.succeed({
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
      }),
    )

    expect(silence.every(({ status }) => status === 'telemetry-silence')).toBe(true)
  })

  it('uses the result tag even when successful data contains a reason field', () => {
    const data = { ...empty, eligible: 7, apiSamples: 7, successful: 6, reason: 'annotation' }
    expect(evaluate(Result.succeed(data)).at(-1)).toEqual({
      signal: 'telemetry-pipeline',
      status: 'healthy',
      traffic: { apiRequests: 7, browserMeasurements: 0 },
    })
  })

  it('sends one pipeline notification for a query failure rather than one per objective', async () => {
    const h = harness()

    await Effect.runPromise(
      persistAndNotify(
        h.kv,
        h.email,
        evaluate(Result.fail({ reason: 'authorization', dataset: 'browser', httpStatus: 403 })),
        'failure-1',
        config,
      ),
    )

    expect(h.messages.map(({ subject }) => subject)).toEqual([
      '[FIRING] GBFM: Monitoring cannot read telemetry (staging)',
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
      '[FIRING] GBFM: API success rate is outside target (staging)',
      '[RESOLVED] GBFM: API success rate is back within target (staging)',
    ])
    expect(h.messages[0]).toMatchObject({
      from: { email: 'alerts@example.com', name: 'GBFM Alerts' },
      to: 'oncall@example.com',
    })
    expect(h.messages[0]?.text).toContain(
      'Monitoring in Cloudflare: https://dash.cloudflare.com/example',
    )
    expect(h.values.get('slo:availability')).toBe('{"active":false}')
  })

  it('drills fire then resolve on isolated state and is inert in production', async () => {
    const h = harness()
    await Effect.runPromise(runDrill(h.kv, h.email, 'drill-1', config))
    await Effect.runPromise(runDrill(h.kv, h.email, 'drill-duplicate', config))
    expect(h.messages.map(({ subject }) => subject)).toEqual([
      '[FIRING] GBFM: API success rate is outside target (staging)',
      '[RESOLVED] GBFM: API success rate is back within target (staging)',
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

  it('keeps silence distinct from query failure without sending a false recovery', async () => {
    const h = harness()
    await Effect.runPromise(
      persistAndNotify(
        h.kv,
        h.email,
        evaluate(Result.fail({ reason: 'network', dataset: 'api' })),
        'one',
        config,
      ),
    )
    await Effect.runPromise(
      persistAndNotify(h.kv, h.email, evaluate(Result.succeed(empty)), 'two', config),
    )
    expect(h.messages).toHaveLength(2)
    expect(h.messages[1]?.subject).toContain('[FIRING]')
    expect(h.messages[1]?.text).toContain('queries succeeded')
    expect(h.messages[1]?.text).toContain('Low traffic or a capture problem')
  })

  it('recovers a legacy incident without invented history or overlapping API counts', async () => {
    const h = harness()
    h.values.set(
      'slo:telemetry-pipeline',
      JSON.stringify({ active: true, status: 'ingestion-failure', incidentKey: 'legacy-incident' }),
    )

    const metrics = evaluate(
      Result.succeed({ ...empty, eligible: 3, successful: 3, apiSamples: 3 }),
    )

    expect(metrics.at(-1)).toEqual({
      signal: 'telemetry-pipeline',
      status: 'healthy',
      traffic: { apiRequests: 3, browserMeasurements: 0 },
    })
    await Effect.runPromise(persistAndNotify(h.kv, h.email, metrics, 'three', config))
    expect(h.messages).toHaveLength(1)
    const text = h.messages[0]?.text
    expect(text).toContain('Estimated API requests: 3')
    expect(text).toContain('API success rate: 3 of 100 required')
    expect(text).toContain('too few samples')

    for (const phrase of [
      '6 events',
      'all objectives are healthy',
      'SQL',
      'authorization',
      'ingestion recovered',
    ])
      expect(text).not.toContain(phrase)
  })

  it('does not clear an objective alert on insufficient volume', async () => {
    const h = harness()
    await Effect.runPromise(persistAndNotify(h.kv, h.email, [burning], 'one', config))
    await Effect.runPromise(
      persistAndNotify(
        h.kv,
        h.email,
        [{ ...burning, status: 'insufficient-volume', samples: 2 }],
        'two',
        config,
      ),
    )
    expect(h.messages).toHaveLength(1)
    expect(JSON.parse(h.values.get('slo:availability') ?? '{}').active).toBe(true)
  })

  it('shows active objectives on pipeline recovery and links subordinate escaped identifiers', () => {
    const metrics = evaluate(
      Result.succeed({
        ...empty,
        eligible: 150,
        successful: 140,
        apiSamples: 150,
        apiP95: 100,
      }),
    )

    const pipeline = metrics.find((metric) => metric.signal === 'telemetry-pipeline')

    if (!pipeline) throw new Error('Missing pipeline')
    const release = 'a'.repeat(40)

    const email = renderNotification(
      {
        kind: 'resolved',
        signal: pipeline.signal,
        status: pipeline.status,
        incidentKey: '<private>&reference',
      },
      pipeline,
      { ...config, release },
      metrics,
    )

    expect(email.text).toContain('separate active alerts: API success rate')
    expect(email.text).toContain(`https://github.com/guidefari/gbfm/commit/${release}`)
    expect(email.html).toContain('href="https://dash.cloudflare.com/example"')
    expect(email.html).toContain('&lt;private&gt;&amp;reference')
    expect(email.html).not.toContain('<private>')
    expect(email.html).toContain('Incident reference: <span')
    expect(email.html).not.toContain('Incident reference: <a')
    expect(email.html).toContain('GBFM monitoring · staging')
    expect(email.html).toContain('Recovered</p>')
    expect(email.text).toContain('Recovered: Recent telemetry is available again')
    expect(email.subject).toContain('[RESOLVED]')
    expect(email.html.indexOf('Incident reference')).toBeGreaterThan(
      email.html.indexOf('Next action'),
    )
  })

  it('describes each performance signal with units, targets and actions in both formats', () => {
    const metrics = evaluate(
      Result.succeed({
        eligible: 100,
        successful: 90,
        apiSamples: 100,
        apiP95: 1800,
        lcpSamples: 75,
        lcpP75: 3000,
        inpSamples: 75,
        inpP75: 350,
        clsSamples: 75,
        clsP75: 0.2,
      }),
    )

    for (const metric of metrics.slice(0, 5)) {
      const message = renderNotification(
        { kind: 'fired', signal: metric.signal, status: metric.status, incidentKey: 'fixture' },
        metric,
        config,
        metrics,
      )

      expect(message.text).toContain('Next action:')
      expect(message.text).toContain('Target:')
      expect(message.html).toContain('Current evidence')
      expect(message.text).not.toContain('telemetry-pipeline')
    }
  })
})

describe('safe query diagnostics', () => {
  const analyticsConfig = {
    accountId: 'fixture-account',
    apiToken: 'DO_NOT_LEAK',
    apiDataset: 'gbfm_api_prod',
    browserDataset: 'gbfm_www_prod',
    release: 'fixture',
    stage: 'prod',
    windowMinutes: 15,
  }

  it.each([
    [401, 'authorization'],
    [403, 'authorization'],
    [400, 'invalid-query'],
    [422, 'invalid-query'],
    [503, 'http'],
    [200, 'invalid-response'],
  ])('classifies HTTP %s without exposing the body or token', async (status, reason) => {
    const client = HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response('SENSITIVE_BODY', { status })),
      ),
    )

    const result = await Effect.runPromise(
      Effect.result(querySlos(analyticsConfig)).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
      ),
    )

    expect(Result.isFailure(result)).toBe(true)

    if (!Result.isFailure(result)) throw new Error('Expected diagnostic')
    expect(result.failure).toMatchObject({ reason, httpStatus: status })

    for (const phrase of ['SENSITIVE_BODY', 'DO_NOT_LEAK', 'Bearer'])
      expect(JSON.stringify(result.failure)).not.toContain(phrase)
    const metrics = evaluate(result)
    const pipeline = metrics.find((metric) => metric.signal === 'telemetry-pipeline')

    if (!pipeline) throw new Error('Missing pipeline')

    const message = renderNotification(
      {
        kind: 'fired',
        signal: pipeline.signal,
        status: pipeline.status,
        incidentKey: 'safe-fixture',
      },
      pipeline,
      config,
      metrics,
    )

    expect(message.text).toContain(`HTTP ${status}`)
    expect(message.html).toContain('Action needed</p>')
    expect(message.text).toContain('Action needed: Monitoring cannot read telemetry')
    expect(message.subject).toContain('[FIRING]')

    for (const phrase of ['SENSITIVE_BODY', 'DO_NOT_LEAK'])
      expect(`${message.text}${message.html}`).not.toContain(phrase)
  })

  it('classifies transport failure without carrying the request or cause', async () => {
    const client = HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause: 'SENSITIVE_CAUSE' }),
        }),
      ),
    )

    const result = await Effect.runPromise(
      Effect.result(querySlos(analyticsConfig)).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
      ),
    )

    expect(Result.isFailure(result)).toBe(true)

    if (!Result.isFailure(result)) throw new Error('Expected diagnostic')
    expect(result.failure).toMatchObject({ reason: 'network' })

    for (const phrase of ['DO_NOT_LEAK', 'SENSITIVE_CAUSE'])
      expect(JSON.stringify(result.failure)).not.toContain(phrase)
  })

  it('distinguishes local request failures from network errors', async () => {
    const client = HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.EncodeError({ request, cause: 'SENSITIVE_CAUSE' }),
        }),
      ),
    )

    const result = await Effect.runPromise(
      Effect.result(querySlos(analyticsConfig)).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
      ),
    )

    if (!Result.isFailure(result)) throw new Error('Expected diagnostic')
    expect(result.failure).toMatchObject({ reason: 'request' })

    for (const phrase of ['DO_NOT_LEAK', 'SENSITIVE_CAUSE'])
      expect(JSON.stringify(result.failure)).not.toContain(phrase)
  })

  it('identifies a malformed browser schema after a successful API response', async () => {
    const client = HttpClient.make((request) => {
      const body = request.body

      const isBrowserQuery =
        Predicate.isTagged(body, 'Uint8Array') &&
        new TextDecoder().decode(body.body).includes('FROM gbfm_www_prod')

      const data = isBrowserQuery
        ? [{ vital: 'SENSITIVE_BODY', samples: 7, p75: 120 }]
        : [{ eligible: '3', successful: '3', samples: '3', p95: '80' }]

      return Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({ data })))
    })

    const result = await Effect.runPromise(
      Effect.result(querySlos(analyticsConfig)).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
      ),
    )

    if (!Result.isFailure(result)) throw new Error('Expected diagnostic')
    expect(result.failure).toMatchObject({
      reason: 'invalid-response',
      dataset: 'browser',
      httpStatus: 200,
    })

    for (const phrase of ['DO_NOT_LEAK', 'SENSITIVE_BODY'])
      expect(JSON.stringify(result.failure)).not.toContain(phrase)
  })
})
