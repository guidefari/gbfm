import * as Sentry from '@sentry/bun'
import { Context, Effect, Layer } from 'effect'
import { SentryClientService } from './sentry-client.service'

type MonitorConfig = NonNullable<Parameters<typeof Sentry.captureCheckIn>[1]>

export interface SentryService {
  readonly captureException: (
    error: unknown,
    context?: Record<string, unknown>
  ) => Effect.Effect<void>
  readonly captureMessage: (message: string, level?: Sentry.SeverityLevel) => Effect.Effect<void>
  readonly startCheckIn: (
    monitorSlug: string,
    monitorConfig: MonitorConfig
  ) => Effect.Effect<string | undefined>
  readonly finishCheckIn: (
    monitorSlug: string,
    checkInId: string | undefined,
    status: 'ok' | 'error'
  ) => Effect.Effect<void>
}

export const SentryService = Context.Service<SentryService>('SentryService')

export const SentryServiceLayer = Layer.effect(
  SentryService,
  Effect.gen(function* () {
    const { enabled } = yield* SentryClientService

    return {
      captureException: (error, context) =>
        Effect.sync(() => {
          if (!enabled) return
          Sentry.captureException(error, context ? { extra: context } : undefined)
        }),
      captureMessage: (message, level) =>
        Effect.sync(() => {
          if (!enabled) return
          Sentry.captureMessage(message, level)
        }),
      startCheckIn: (monitorSlug, monitorConfig) =>
        Effect.sync(() => {
          if (!enabled) return undefined
          return Sentry.captureCheckIn({ monitorSlug, status: 'in_progress' }, monitorConfig)
        }),
      finishCheckIn: (monitorSlug, checkInId, status) =>
        Effect.sync(() => {
          if (!enabled || !checkInId) return
          Sentry.captureCheckIn({ monitorSlug, checkInId, status })
        })
    }
  })
)
