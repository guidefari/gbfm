import { Data, Effect, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'

import type { QueryData } from './domain'

const datasetName = (value: string): string => {
  if (!/^[A-Za-z0-9_]+$/.test(value))
    throw new Error('Analytics Engine dataset names must be alphanumeric or underscore')

  return value
}

const releaseName = (value: string): string => {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(value))
    throw new Error('APP_RELEASE must be a bounded immutable identifier')

  return value
}

const stageName = (value: string): string => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw new Error('Stage must be a bounded identifier')

  return value
}

const windowMinutes = (value: number): number => {
  if (!Number.isInteger(value) || value < 1 || value > 60)
    throw new Error('Evaluation window must be 1-60 minutes')

  return value
}

/** API points: index1=request, blob1=release, blob2=stage, blob3=method, blob4=route template, double1=duration ms, double2=status. */
export const apiSql = (
  dataset: string,
  release: string,
  stage: string,
  minutes: number,
): string => `SELECT
  sum(_sample_interval) AS eligible,
  sum(if(double2 < 500, _sample_interval, 0)) AS successful,
  sum(_sample_interval) AS samples,
  quantileWeighted(double1, _sample_interval, 0.95) AS p95
FROM ${datasetName(dataset)}
WHERE timestamp >= NOW() - INTERVAL '${windowMinutes(minutes)}' MINUTE
  AND index1 = 'request' AND blob1 = '${releaseName(release)}' AND blob2 = '${stageName(stage)}'
  AND blob3 != 'OPTIONS' AND blob4 NOT LIKE '/health/%' AND double2 NOT BETWEEN 300 AND 399 AND double2 != 499`

/** Browser points use the existing bounded envelope: index1=web-vital, blob1=release, blob2=stage, blob4=vital name, double1=value. */
export const browserSql = (
  dataset: string,
  release: string,
  stage: string,
  minutes: number,
): string => `SELECT blob4 AS vital,
  sum(_sample_interval / double2) AS samples,
  quantileWeighted(double1, _sample_interval / double2, 0.75) AS p75
FROM ${datasetName(dataset)}
WHERE timestamp >= NOW() - INTERVAL '${windowMinutes(minutes)}' MINUTE
  AND index1 = 'web-vital' AND blob1 = '${releaseName(release)}' AND blob2 = '${stageName(stage)}'
  AND double2 > 0 AND blob4 IN ('lcp', 'inp', 'cls')
GROUP BY blob4`

const Numeric = Schema.Union([Schema.Number, Schema.NumberFromString])

const ApiRow = Schema.Struct({
  eligible: Numeric,
  successful: Numeric,
  samples: Numeric,
  p95: Schema.NullOr(Numeric),
})

const BrowserRow = Schema.Struct({
  vital: Schema.Literals(['lcp', 'inp', 'cls']),
  samples: Numeric,
  p75: Schema.NullOr(Numeric),
})

const ApiResponse = Schema.Struct({ data: Schema.Array(ApiRow) })

const BrowserResponse = Schema.Struct({ data: Schema.Array(BrowserRow) })

export const parseApiResponse = Schema.decodeUnknownEffect(ApiResponse)

export const parseBrowserResponse = Schema.decodeUnknownEffect(BrowserResponse)

export class AnalyticsQueryError extends Data.TaggedError('AnalyticsQueryError')<{
  readonly reason: 'request' | 'response'
}> {}

export interface AnalyticsConfig {
  readonly accountId: string
  readonly apiToken: string
  readonly apiDataset: string
  readonly browserDataset: string
  readonly release: string
  readonly stage: string
  readonly windowMinutes: number
}

const execute = (client: HttpClient.HttpClient, config: AnalyticsConfig, sql: string) =>
  Effect.gen(function* () {
    const request = HttpClientRequest.bodyText(
      HttpClientRequest.post(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/analytics_engine/sql`,
        { headers: { authorization: `Bearer ${config.apiToken}`, 'content-type': 'text/plain' } },
      ),
      sql,
      'text/plain',
    )

    const response = yield* client
      .execute(request)
      .pipe(Effect.mapError(() => new AnalyticsQueryError({ reason: 'request' })))

    if (response.status < 200 || response.status >= 300)
      return yield* new AnalyticsQueryError({ reason: 'request' })

    return response
  })

export const querySlos = Effect.fn('TelemetryEvaluator.querySlos')(function* (
  config: AnalyticsConfig,
) {
  const client = yield* HttpClient.HttpClient

  const [apiResponse, browserResponse] = yield* Effect.all(
    [
      execute(
        client,
        config,
        apiSql(config.apiDataset, config.release, config.stage, config.windowMinutes),
      ),
      execute(
        client,
        config,
        browserSql(config.browserDataset, config.release, config.stage, config.windowMinutes),
      ),
    ],
    { concurrency: 2 },
  )

  const api = yield* HttpClientResponse.schemaBodyJson(ApiResponse)(apiResponse).pipe(
    Effect.mapError(() => new AnalyticsQueryError({ reason: 'response' })),
  )

  const browser = yield* HttpClientResponse.schemaBodyJson(BrowserResponse)(browserResponse).pipe(
    Effect.mapError(() => new AnalyticsQueryError({ reason: 'response' })),
  )

  const apiRow = api.data[0]
  const vital = (name: 'lcp' | 'inp' | 'cls') => browser.data.find((row) => row.vital === name)

  return {
    eligible: apiRow?.eligible ?? 0,
    successful: apiRow?.successful ?? 0,
    apiSamples: apiRow?.samples ?? 0,
    apiP95: apiRow?.p95 ?? 0,
    lcpSamples: vital('lcp')?.samples ?? 0,
    lcpP75: vital('lcp')?.p75 ?? 0,
    inpSamples: vital('inp')?.samples ?? 0,
    inpP75: vital('inp')?.p75 ?? 0,
    clsSamples: vital('cls')?.samples ?? 0,
    clsP75: vital('cls')?.p75 ?? 0,
  } satisfies QueryData
})
