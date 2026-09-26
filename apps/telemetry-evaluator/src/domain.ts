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
  | 'ingestion-failure'

export interface Metric {
  readonly signal: Signal
  readonly status: Status
  readonly value: number | null
  readonly threshold: number | null
  readonly samples: number
  readonly minimumSamples: number
  readonly unit: 'percent' | 'milliseconds' | 'ratio' | 'events'
}

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
  signal: Signal,
  value: number,
  threshold: number,
  samples: number,
  minimumSamples: number,
  unit: Metric['unit'],
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

const unavailable = (status: 'telemetry-silence' | 'ingestion-failure'): ReadonlyArray<Metric> =>
  signals.map((signal) => ({
    signal,
    status,
    value: null,
    threshold: signal === 'telemetry-pipeline' ? 1 : null,
    samples: 0,
    minimumSamples: signal === 'telemetry-pipeline' ? 1 : 0,
    unit: 'events',
  }))

export const evaluate = (data: QueryData | 'query-failure'): ReadonlyArray<Metric> => {
  if (data === 'query-failure') return unavailable('ingestion-failure')

  const total =
    data.eligible + data.apiSamples + data.lcpSamples + data.inpSamples + data.clsSamples

  if (total === 0) return unavailable('telemetry-silence')
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
      value: total,
      threshold: 1,
      samples: total,
      minimumSamples: 1,
      unit: 'events',
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
    (metric.status === 'telemetry-silence' || metric.status === 'ingestion-failure'))

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

  const resolved: ReadonlyArray<Notification> = previous.active
    ? [
        {
          kind: 'resolved',
          signal: metric.signal,
          status: metric.status,
          incidentKey: previous.incidentKey ?? evaluationId,
        },
      ]
    : []

  return {
    state: { active: true, status: metric.status, incidentKey } satisfies AlertState,
    notifications: [...resolved, fired],
  }
}
