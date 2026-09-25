import { Effect, Schema } from 'effect'

import type { AlertState, Metric, Notification, Signal } from './domain'
import { transition } from './domain'

export interface KvStore {
  readonly get: (key: string) => Promise<string | null>
  readonly put: (key: string, value: string) => Promise<void>
}

export interface EmailMessage {
  readonly from: { readonly email: string; readonly name: string }
  readonly to: string
  readonly subject: string
  readonly html: string
  readonly text: string
}

export interface EmailBinding {
  readonly send: (message: EmailMessage) => Promise<{ readonly messageId: string }>
}

export interface AlertConfig {
  readonly release: string
  readonly environment: string
  readonly fromEmail: string
  readonly fromName: string
  readonly toEmail: string
  readonly investigationUrl: string
}

const StoredState = Schema.Struct({
  active: Schema.Boolean,
  status: Schema.optional(
    Schema.Literals([
      'healthy',
      'burning',
      'insufficient-volume',
      'telemetry-silence',
      'ingestion-failure',
    ]),
  ),
  incidentKey: Schema.optional(Schema.String),
})

const readState = (kv: KvStore, signal: Signal) =>
  Effect.tryPromise(() => kv.get(`slo:${signal}`)).pipe(
    Effect.flatMap((value) =>
      value === null
        ? Effect.succeed({ active: false } satisfies AlertState)
        : Effect.try(() => JSON.parse(value)).pipe(
            Effect.flatMap((unknownState) => Schema.decodeUnknownEffect(StoredState)(unknownState)),
          ),
    ),
  )

export const renderNotification = (
  notification: Notification,
  metric: Metric,
  config: AlertConfig,
): EmailMessage => {
  const action = notification.kind === 'fired' ? 'FIRING' : 'RESOLVED'
  const detail = `${metric.signal}: ${metric.value ?? 'unavailable'} ${metric.unit}; threshold ${metric.threshold ?? 'n/a'}; samples ${metric.samples}/${metric.minimumSamples}`
  const text = `[${action}] GBFM SLO ${detail}\nRelease: ${config.release}\nIncident: ${notification.incidentKey}\nInvestigate: ${config.investigationUrl}`

  return {
    from: { email: config.fromEmail, name: config.fromName },
    to: config.toEmail,
    subject: `[${action}] GBFM ${metric.signal} (${config.environment})`,
    text,
    html: `<p><strong>${action}</strong> ${detail}</p><p>Release: ${config.release}</p><p>Incident: ${notification.incidentKey}</p><p><a href="${config.investigationUrl}">Investigate in Cloudflare</a></p>`,
  }
}

export const persistAndNotify = Effect.fn('TelemetryEvaluator.persistAndNotify')(function* (
  kv: KvStore,
  email: EmailBinding,
  metrics: ReadonlyArray<Metric>,
  evaluationId: string,
  config: AlertConfig,
) {
  for (const metric of metrics) {
    const previous = yield* readState(kv, metric.signal)
    const next = transition(previous, metric, evaluationId)

    for (const notification of next.notifications) {
      yield* Effect.tryPromise(() => email.send(renderNotification(notification, metric, config)))
    }

    yield* Effect.tryPromise(() => kv.put(`slo:${metric.signal}`, JSON.stringify(next.state)))
  }
})

/** Non-production drill uses isolated keys and synthetic inputs; it never queries or mutates production incidents. */
export const runDrill = Effect.fn('TelemetryEvaluator.runDrill')(function* (
  kv: KvStore,
  email: EmailBinding,
  evaluationId: string,
  config: AlertConfig,
) {
  if (config.environment === 'production') return

  const completionKey = `drill:completed:${config.release}`
  if ((yield* Effect.tryPromise(() => kv.get(completionKey))) !== null) return

  const drillKv: KvStore = {
    get: (key) => kv.get(`drill:${key}`),
    put: (key, value) => kv.put(`drill:${key}`, value),
  }

  const base: Metric = {
    signal: 'availability',
    status: 'burning',
    value: 0,
    threshold: 99.5,
    samples: 100,
    minimumSamples: 100,
    unit: 'percent',
  }

  yield* persistAndNotify(drillKv, email, [base], `${evaluationId}-fire`, config)
  yield* persistAndNotify(
    drillKv,
    email,
    [{ ...base, status: 'healthy', value: 100 }],
    `${evaluationId}-resolve`,
    config,
  )
  yield* Effect.tryPromise(() => kv.put(completionKey, evaluationId))
})
