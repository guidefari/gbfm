import * as Sentry from '@sentry/bun'

type Client = NonNullable<ReturnType<typeof Sentry.getClient>>

import { Context, Effect, Layer } from 'effect'
import { ConfigService } from './config.service'

export interface SentryClientService {
  readonly client: Client | undefined
  readonly enabled: boolean
}

export const SentryClientService = Context.Service<SentryClientService>(
  'SentryClientService'
)

export const SentryClientServiceLive = Layer.effect(
  SentryClientService,
  Effect.gen(function* () {
    const { sentry } = yield* ConfigService
    const enabled =
      sentry.dsn.length > 0 || process.env.SENTRY_ENABLED === 'true'

    if (!enabled) {
      yield* Effect.logWarning('[sentry] disabled (no SENTRY_BACKEND_DSN)')
      return { client: undefined, enabled: false }
    }

    const existingClient = Sentry.getClient()
    if (existingClient) {
      yield* Effect.sync(() => {
        console.warn(
          `[sentry] client already initialized env=${sentry.environment}`
        )
      })
      return { client: existingClient, enabled: true }
    }

    const debugSentry = process.env.SENTRY_DEBUG === 'true'
    const client = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Sentry.init({
          dsn: sentry.dsn,
          environment: sentry.environment,
          tracesSampleRate: 1.0,
          sendDefaultPii: false,
          enableLogs: true,
          debug: debugSentry
        })
      ),
      () =>
        Effect.promise(async () => {
          await Sentry.flush(2000)
          await Sentry.close(2000)
        })
    )

    yield* Effect.sync(() => {
      console.warn(`[sentry] init env=${sentry.environment} traces=1`)
    })

    if (debugSentry) {
      yield* Effect.sync(() => {
        Sentry.startSpan(
          { name: 'sentry.boot.smoke-test', op: 'boot' },
          () => {}
        )
      })
    }

    return { client, enabled: true }
  })
)
