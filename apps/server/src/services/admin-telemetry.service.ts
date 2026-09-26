import type { AdminTelemetryResponse } from '@gbfm/api/admin'
import { Context, Data, Effect, Layer, Result, Schema } from 'effect'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'

const WINDOW_HOURS = 24

const SLICE_LIMIT = 20

export interface AnalyticsEngineConfig {
  readonly accountId: string
  readonly apiToken: string
  readonly dataset: string
}

export const AnalyticsEngineConfig = Context.Service<AnalyticsEngineConfig>('AnalyticsEngineConfig')

export class TelemetryQueryError extends Data.TaggedError('TelemetryQueryError')<{
  readonly reason: 'configuration' | 'request' | 'response'
}> {}

const AnalyticsRow = Schema.Struct({
  name: Schema.String,
  route: Schema.String,
  release: Schema.String,
  browser: Schema.String,
  samples: Schema.Number,
  p75: Schema.NullOr(Schema.Number),
})

const AnalyticsResponse = Schema.Struct({ data: Schema.Array(AnalyticsRow) })

export type TelemetrySectionName = 'webVitals' | 'navigation' | 'errors' | 'player'

const eventKinds = {
  webVitals: 'web-vital',
  navigation: 'navigation',
  errors: 'ui-error',
  player: 'player',
} as const satisfies Record<TelemetrySectionName, string>

/**
 * Builds a bounded, sampling-aware Analytics Engine query. Blob positions match the
 * versioned browser ingestion point: release, stage, kind, name, route, browser, session.
 */
export const telemetrySectionSql = (dataset: string, section: TelemetrySectionName): string => {
  if (!/^[A-Za-z0-9_]+$/.test(dataset)) throw new TelemetryQueryError({ reason: 'configuration' })

  const percentile =
    section === 'errors' || section === 'player'
      ? 'NULL'
      : 'quantileWeighted(double1, _sample_interval / double2, 0.75)'

  return `SELECT blob4 AS name, blob5 AS route, blob1 AS release, blob6 AS browser, sum(_sample_interval / double2) AS samples, ${percentile} AS p75
FROM ${dataset}
WHERE timestamp >= NOW() - INTERVAL '${WINDOW_HOURS}' HOUR AND index1 = '${eventKinds[section]}' AND double2 > 0
GROUP BY blob4, blob5, blob1, blob6
ORDER BY samples DESC
LIMIT ${SLICE_LIMIT}`
}

export interface AdminTelemetryService {
  readonly dashboard: Effect.Effect<AdminTelemetryResponse>
}

export const AdminTelemetryService = Context.Service<AdminTelemetryService>('AdminTelemetryService')

type TelemetryRows = AdminTelemetryResponse['sections']['webVitals']['rows']

const querySection = (
  client: HttpClient.HttpClient,
  config: AnalyticsEngineConfig,
  section: TelemetrySectionName,
) =>
  Effect.gen(function* () {
    const request = HttpClientRequest.bodyText(
      HttpClientRequest.make('POST')(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/analytics_engine/sql`,
        {
          headers: {
            authorization: `Bearer ${config.apiToken}`,
            'content-type': 'text/plain',
          },
        },
      ),
      telemetrySectionSql(config.dataset, section),
      'text/plain',
    )

    const response = yield* client
      .execute(request)
      .pipe(Effect.mapError(() => new TelemetryQueryError({ reason: 'request' })))

    if (response.status < 200 || response.status >= 300)
      return yield* new TelemetryQueryError({ reason: 'request' })

    return yield* HttpClientResponse.schemaBodyJson(AnalyticsResponse)(response).pipe(
      Effect.mapError(() => new TelemetryQueryError({ reason: 'response' })),
      Effect.map(({ data }) => data),
    )
  })

export const AdminTelemetryServiceLive = Layer.effect(
  AdminTelemetryService,
  Effect.gen(function* () {
    const config = yield* AnalyticsEngineConfig
    const client = yield* HttpClient.HttpClient

    const section = (result: Result.Result<TelemetryRows, TelemetryQueryError>) => {
      const empty: TelemetryRows = []

      return Result.isSuccess(result)
        ? { available: true, rows: result.success }
        : { available: false, rows: empty }
    }

    return {
      dashboard: Effect.gen(function* () {
        const results = yield* Effect.all(
          {
            webVitals: Effect.result(querySection(client, config, 'webVitals')),
            navigation: Effect.result(querySection(client, config, 'navigation')),
            errors: Effect.result(querySection(client, config, 'errors')),
            player: Effect.result(querySection(client, config, 'player')),
          },
          { concurrency: 'unbounded' },
        )

        const values: AdminTelemetryResponse['sections'] = {
          webVitals: section(results.webVitals),
          navigation: section(results.navigation),
          errors: section(results.errors),
          player: section(results.player),
        }

        const available = Object.values(values).filter((section) => section.available)
        const hasRows = available.some((section) => section.rows.length > 0)

        return {
          generatedAt: new Date().toISOString(),
          windowHours: WINDOW_HOURS,
          state: available.length < 4 ? 'partial' : hasRows ? 'complete' : 'empty',
          retentionNotice:
            'This 24-hour view is constrained by Cloudflare Analytics Engine retention; unavailable sections are shown as partial data.',
          sections: values,
        } satisfies AdminTelemetryResponse
      }),
    }
  }),
)

export const AdminTelemetryUnavailableLayer = Layer.succeed(AdminTelemetryService, {
  dashboard: Effect.succeed({
    generatedAt: new Date(0).toISOString(),
    windowHours: WINDOW_HOURS,
    state: 'partial',
    retentionNotice:
      'Analytics Engine querying is not configured; all telemetry sections are unavailable.',
    sections: {
      webVitals: { available: false, rows: [] },
      navigation: { available: false, rows: [] },
      errors: { available: false, rows: [] },
      player: { available: false, rows: [] },
    },
  } satisfies AdminTelemetryResponse),
})
