import * as Sentry from '@sentry/bun'
import { Context, Effect, Layer } from 'effect'
import { SentryClientService } from './sentry-client.service'

export interface SentryService {
  readonly captureException: (
    error: unknown,
    context?: Record<string, unknown>
  ) => Effect.Effect<void>
  readonly captureMessage: (message: string, level?: Sentry.SeverityLevel) => Effect.Effect<void>
}

export const SentryService = Context.Service<SentryService>('SentryService')

export const SentryServiceLive = Layer.effect(
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
        })
    }
  })
)
