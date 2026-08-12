import * as Sentry from '@sentry/core'
import { Context, Effect, Layer } from 'effect'

// Platform-agnostic on purpose: @sentry/core's captureException/captureMessage/
// captureCheckIn operate on whichever client the platform SDK bound at init
// time (@sentry/bun on the ECS/Bun runtime, @sentry/cloudflare on the Worker).
// This service must not import either platform SDK directly, or it drags that
// platform's Node/workerd-only init code into every consumer.
type MonitorConfig = NonNullable<Parameters<typeof Sentry.captureCheckIn>[1]>
type CaptureContext = Sentry.Extras

export interface SentryService {
  readonly captureException: (cause: unknown, context?: CaptureContext) => Effect.Effect<void>
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

export interface SentryEnabled {
  readonly enabled: boolean
}

export const SentryEnabled = Context.Service<SentryEnabled>('SentryEnabled')

export const SentryServiceLayer = Layer.effect(
  SentryService,
  Effect.gen(function* () {
    const { enabled } = yield* SentryEnabled

    return {
      captureException: (cause, context) =>
        Effect.sync(() => {
          if (!enabled) return
          Sentry.captureException(cause, context ? { extra: context } : undefined)
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
