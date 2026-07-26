import * as Sentry from '@sentry/bun'

type Client = NonNullable<ReturnType<typeof Sentry.getClient>>

import { Context, Effect, Layer } from 'effect'
import { hasLocalSentryContext, shouldEnableSentry } from '@/lib/sentry'
import { ConfigService } from './config.service'

export interface SentryClientService {
  readonly client: Client | undefined
  readonly enabled: boolean
}

export const SentryClientService = Context.Service<SentryClientService>('SentryClientService')

export const SentryClientServiceLayer = Layer.effect(
  SentryClientService,
  Effect.gen(function* () {
    const { sentry } = yield* ConfigService
    const enabled = shouldEnableSentry(sentry.dsn, sentry.environment)

    if (!enabled) {
      yield* Effect.logWarning(
        `[sentry] disabled (dsn=${sentry.dsn ? 'set' : 'missing'}, env=${sentry.environment}, set SENTRY_ENABLED=true to force)`
      )
      return { client: undefined, enabled: false }
    }

    const existingClient = Sentry.getClient()
    if (existingClient) {
      yield* Effect.sync(() => {
        console.warn(`[sentry] client already initialized env=${sentry.environment}`)
      })
      return { client: existingClient, enabled: true }
    }

    const debugSentry = process.env.SENTRY_DEBUG === 'true'
    const client = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Sentry.init({
          dsn: sentry.dsn,
          environment: sentry.environment,
          release: process.env.SENTRY_RELEASE,
          tracesSampleRate: 1.0,
          sendDefaultPii: false,
          enableLogs: true,
          debug: debugSentry,
          beforeSend: (event) => {
            return hasLocalSentryContext(event) ? null : event
          },
          beforeSendTransaction: (event) => {
            return hasLocalSentryContext(event) ? null : event
          }
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
        Sentry.startSpan({ name: 'sentry.boot.smoke-test', op: 'boot' }, () => {})
      })
    }

    return { client, enabled: true }
  })
)
