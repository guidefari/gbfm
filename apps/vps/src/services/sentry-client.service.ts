import * as Sentry from '@sentry/bun'

type Client = NonNullable<ReturnType<typeof Sentry.getClient>>

import { Context, Effect, Layer } from 'effect'
import { ConfigService } from './config.service'

export interface SentryClientService {
  readonly client: Client | undefined
  readonly enabled: boolean
}

export const SentryClientService = Context.GenericTag<SentryClientService>(
  'SentryClientService'
)

export const SentryClientServiceLive = Layer.scoped(
  SentryClientService,
  Effect.gen(function* () {
    const { sentry } = yield* ConfigService
    const enabled =
      sentry.dsn.length > 0 || process.env.SENTRY_ENABLED === 'true'

    if (!enabled) {
      yield* Effect.logWarning('[sentry] disabled (no SENTRY_BACKEND_DSN)')
      return SentryClientService.of({ client: undefined, enabled: false })
    }

    const debugSentry = process.env.SENTRY_DEBUG === 'true'
    const client = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Sentry.init({
          dsn: sentry.dsn,
          environment: sentry.environment,
          tracesSampleRate: sentry.environment === 'production' ? 0.1 : 1.0,
          sendDefaultPii: false,
          enableLogs: true,
          skipOpenTelemetrySetup: true,
          debug: debugSentry
        })
      ),
      () =>
        Effect.promise(async () => {
          await Sentry.flush(2000)
          await Sentry.close(2000)
        })
    )

    yield* Effect.log(
      `[sentry] init env=${sentry.environment} traces=${sentry.environment === 'production' ? 0.1 : 1.0}`
    )

    if (debugSentry) {
      yield* Effect.sync(() => {
        Sentry.startSpan(
          { name: 'sentry.boot.smoke-test', op: 'boot' },
          () => {}
        )
      })
    }

    return SentryClientService.of({ client, enabled: true })
  })
)
