import * as Sentry from '@sentry/bun'
import { Context, Effect, Layer } from 'effect'
import { ConfigService } from './config.service'

export interface SentryService {
  readonly captureException: (
    error: unknown,
    context?: Record<string, unknown>
  ) => Effect.Effect<void>
  readonly captureMessage: (
    message: string,
    level?: Sentry.SeverityLevel
  ) => Effect.Effect<void>
}

export const SentryService = Context.GenericTag<SentryService>('SentryService')

export const SentryServiceLive = Layer.scoped(
  SentryService,
  Effect.gen(function* () {
    const { sentry } = yield* ConfigService
    const enabled =
      sentry.dsn.length > 0 || process.env.SENTRY_ENABLED === 'true'

    if (enabled) {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          Sentry.init({
            dsn: sentry.dsn,
            environment: sentry.environment,
            tracesSampleRate: sentry.environment === 'production' ? 0.1 : 1.0,
            sendDefaultPii: false,
            enableLogs: true
          })
        }),
        () =>
          Effect.promise(async () => {
            await Sentry.flush(2000)
            await Sentry.close(2000)
          })
      )
      yield* Effect.log(
        `[sentry] connected env=${sentry.environment} traces=${sentry.environment === 'production' ? 0.1 : 1.0}`
      )
    } else {
      yield* Effect.logWarning('[sentry] disabled (no SENTRY_BACKEND_DSN)')
    }

    return SentryService.of({
      captureException: (error, context) =>
        Effect.sync(() => {
          if (!enabled) return
          Sentry.captureException(
            error,
            context ? { extra: context } : undefined
          )
        }),
      captureMessage: (message, level) =>
        Effect.sync(() => {
          if (!enabled) return
          Sentry.captureMessage(message, level)
        })
    })
  })
)
