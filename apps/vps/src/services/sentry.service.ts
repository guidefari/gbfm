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
    const enabled = sentry.dsn.length > 0

    if (enabled) {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          Sentry.init({
            dsn: sentry.dsn,
            environment: sentry.environment,
            debug: sentry.environment !== 'production',
            tracesSampleRate: sentry.environment === 'production' ? 0.1 : 1.0,
            sendDefaultPii: false,
            beforeSend(event) {
              console.log(
                `[sentry] beforeSend event_id=${event.event_id} level=${event.level}`
              )
              return event
            }
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
      yield* Effect.logWarning('[sentry] disabled (no SENTRY_DSN)')
    }

    const captureException = (
      error: unknown,
      context?: Record<string, unknown>
    ) =>
      Effect.sync(() => {
        if (!enabled) return
        Sentry.captureException(error, context ? { extra: context } : undefined)
      })

    const captureMessage = (message: string, level?: Sentry.SeverityLevel) =>
      Effect.sync(() => {
        if (!enabled) return
        Sentry.captureMessage(message, level)
      })

    return SentryService.of({ captureException, captureMessage })
  })
)
