import { Result } from 'effect'

export const signals = [
  'availability',
  'api-latency',
  'cwv-lcp',
  'cwv-inp',
  'cwv-cls',
  'telemetry-pipeline',
] as const

export type Signal = (typeof signals)[number]

export type Status =
  | 'healthy'
  | 'burning'
  | 'insufficient-volume'
  | 'telemetry-silence'
  | 'query-failure'

export interface QueryDiagnostic {
  readonly reason:
    | 'network'
    | 'request'
    | 'authorization'
    | 'invalid-query'
    | 'http'
    | 'invalid-response'
  readonly dataset: 'api' | 'browser'
  readonly httpStatus?: number | undefined
}

export interface ObjectiveMetric {
  readonly signal: Exclude<Signal, 'telemetry-pipeline'>
  readonly status: Status
  readonly value: number | null
  readonly threshold: number | null
  readonly samples: number
  readonly minimumSamples: number
  readonly unit: 'percent' | 'milliseconds' | 'ratio'
}

export interface PipelineMetric {
  readonly signal: 'telemetry-pipeline'
  readonly status: 'healthy' | 'telemetry-silence' | 'query-failure'
  readonly diagnostic?: QueryDiagnostic | undefined
  readonly traffic?: {
    readonly apiRequests: number
    readonly browserMeasurements: number
  }
}

export type Metric = ObjectiveMetric | PipelineMetric

export interface QueryData {
  readonly eligible: number
  readonly successful: number
  readonly apiSamples: number
  readonly apiP95: number
  readonly lcpSamples: number
  readonly lcpP75: number
  readonly inpSamples: number
  readonly inpP75: number
  readonly clsSamples: number
  readonly clsP75: number
}

const guarded = (
  signal: ObjectiveMetric['signal'],
  value: number,
  threshold: number,
  samples: number,
  minimumSamples: number,
  unit: ObjectiveMetric['unit'],
  passes: boolean,
): Metric => ({
  signal,
  status: samples < minimumSamples ? 'insufficient-volume' : passes ? 'healthy' : 'burning',
  value,
  threshold,
  samples,
  minimumSamples,
  unit,
})

const unavailable = (
  status: 'telemetry-silence' | 'query-failure',
  diagnostic?: QueryDiagnostic,
): ReadonlyArray<Metric> =>
  signals.map(
    (signal): Metric =>
      signal === 'telemetry-pipeline'
        ? { signal, status, diagnostic }
        : {
            signal,
            status,
            value: null,
            threshold: null,
            samples: 0,
            minimumSamples: 0,
            unit: 'ratio',
          },
  )

export const evaluate = (
  result: Result.Result<QueryData, QueryDiagnostic>,
): ReadonlyArray<Metric> => {
  if (Result.isFailure(result)) return unavailable('query-failure', result.failure)

  const data = result.success

  const browserMeasurements = data.lcpSamples + data.inpSamples + data.clsSamples

  if (data.eligible === 0 && data.apiSamples === 0 && browserMeasurements === 0)
    return unavailable('telemetry-silence')
  const availability = data.eligible === 0 ? 0 : (data.successful / data.eligible) * 100

  return [
    guarded(
      'availability',
      availability,
      99.5,
      data.eligible,
      100,
      'percent',
      availability >= 99.5,
    ),
    guarded(
      'api-latency',
      data.apiP95,
      1_000,
      data.apiSamples,
      100,
      'milliseconds',
      data.apiP95 <= 1_000,
    ),
    guarded(
      'cwv-lcp',
      data.lcpP75,
      2_500,
      data.lcpSamples,
      75,
      'milliseconds',
      data.lcpP75 <= 2_500,
    ),
    guarded('cwv-inp', data.inpP75, 200, data.inpSamples, 75, 'milliseconds', data.inpP75 <= 200),
    guarded('cwv-cls', data.clsP75, 0.1, data.clsSamples, 75, 'ratio', data.clsP75 <= 0.1),
    {
      signal: 'telemetry-pipeline',
      status: 'healthy',
      traffic: { apiRequests: data.eligible, browserMeasurements },
    },
  ]
}

export interface AlertState {
  readonly active: boolean
  readonly status?: Status | undefined
  readonly incidentKey?: string | undefined
}

export interface Notification {
  readonly kind: 'fired' | 'resolved'
  readonly signal: Signal
  readonly status: Status
  readonly incidentKey: string
}

const failed = (metric: Metric) =>
  metric.status === 'burning' ||
  (metric.signal === 'telemetry-pipeline' &&
    (metric.status === 'telemetry-silence' || metric.status === 'query-failure'))

export const transition = (previous: AlertState, metric: Metric, evaluationId: string) => {
  const noNotifications: ReadonlyArray<Notification> = []

  if (!failed(metric)) {
    if (previous.active && metric.status === 'healthy') {
      return {
        state: { active: false } satisfies AlertState,
        notifications: [
          {
            kind: 'resolved',
            signal: metric.signal,
            status: metric.status,
            incidentKey: previous.incidentKey ?? evaluationId,
          } satisfies Notification,
        ],
      }
    }

    return { state: previous, notifications: noNotifications }
  }

  if (previous.active && previous.status === metric.status)
    return { state: previous, notifications: noNotifications }
  const incidentKey = `${metric.signal}:${metric.status}:${evaluationId}`

  const fired: Notification = {
    kind: 'fired',
    signal: metric.signal,
    status: metric.status,
    incidentKey,
  }

  return {
    state: { active: true, status: metric.status, incidentKey } satisfies AlertState,
    notifications: [fired],
  }
}
