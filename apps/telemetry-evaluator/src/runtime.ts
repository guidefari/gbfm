import { Data, Effect, Schema } from 'effect'

import type { AlertState, Metric, Signal } from './domain'
import { transition } from './domain'
import { renderNotification, type AlertConfig, type EmailMessage } from './notification'

export type { AlertConfig, EmailMessage } from './notification'

export interface KvStore {
  readonly get: (key: string) => Promise<string | null>
  readonly put: (key: string, value: string) => Promise<void>
}

export interface EmailBinding {
  readonly send: (message: EmailMessage) => Promise<{ readonly messageId: string }>
}

export class TelemetryRuntimeError extends Data.TaggedError('TelemetryRuntimeError')<{
  readonly operation: 'read-state' | 'write-state' | 'send-notification'
}> {}

const StoredState = Schema.Struct({
  active: Schema.Boolean,
  status: Schema.optional(
    Schema.Literals([
      'healthy',
      'burning',
      'insufficient-volume',
      'telemetry-silence',
      'query-failure',
      'ingestion-failure',
    ]),
  ),
  incidentKey: Schema.optional(Schema.String),
})

const readState = (kv: KvStore, signal: Signal) =>
  Effect.tryPromise({
    try: () => kv.get(`slo:${signal}`),
    catch: () => new TelemetryRuntimeError({ operation: 'read-state' }),
  }).pipe(
    Effect.flatMap((value) =>
      value === null
        ? Effect.succeed({ active: false } satisfies AlertState)
        : Effect.try(() => JSON.parse(value)).pipe(
            Effect.flatMap((unknownState) => Schema.decodeUnknownEffect(StoredState)(unknownState)),
            Effect.map(
              (state): AlertState => ({
                ...state,
                status: state.status === 'ingestion-failure' ? 'query-failure' : state.status,
              }),
            ),
            Effect.mapError(() => new TelemetryRuntimeError({ operation: 'read-state' })),
          ),
    ),
  )

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
      yield* Effect.tryPromise({
        try: () => email.send(renderNotification(notification, metric, config, metrics)),
        catch: () => new TelemetryRuntimeError({ operation: 'send-notification' }),
      })
    }

    yield* Effect.tryPromise({
      try: () => kv.put(`slo:${metric.signal}`, JSON.stringify(next.state)),
      catch: () => new TelemetryRuntimeError({ operation: 'write-state' }),
    })
  }
})

/** Non-production drill uses isolated keys and synthetic inputs; it never queries or mutates production incidents. */
export const runDrill = Effect.fn('TelemetryEvaluator.runDrill')(function* (
  kv: KvStore,
  email: EmailBinding,
  evaluationId: string,
  config: AlertConfig,
) {
  if (config.environment === 'prod') return

  const completionKey = `drill:completed:${config.release}`

  if (
    (yield* Effect.tryPromise({
      try: () => kv.get(completionKey),
      catch: () => new TelemetryRuntimeError({ operation: 'read-state' }),
    })) !== null
  )
    return

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
  yield* Effect.tryPromise({
    try: () => kv.put(completionKey, evaluationId),
    catch: () => new TelemetryRuntimeError({ operation: 'write-state' }),
  })
})
