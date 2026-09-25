import { Effect, ManagedRuntime, Result } from 'effect'
import { FetchHttpClient, type HttpClient } from 'effect/unstable/http'

import { querySlos } from './analytics'
import { evaluate } from './domain'
import { persistAndNotify, runDrill, type EmailBinding } from './runtime'

export interface Env {
  readonly CLOUDFLARE_ACCOUNT_ID: string
  readonly CLOUDFLARE_API_TOKEN: string
  readonly API_ANALYTICS_DATASET: string
  readonly BROWSER_ANALYTICS_DATASET: string
  readonly APP_RELEASE: string
  readonly APP_ENVIRONMENT: string
  readonly ALERT_FROM_EMAIL: string
  readonly ALERT_FROM_NAME: string
  readonly ALERT_TO_EMAIL: string
  readonly CLOUDFLARE_INVESTIGATION_URL: string
  readonly SLO_STATE: KVNamespace
  readonly EMAIL: EmailBinding
  readonly SLO_DRILL?: string
}

const scheduled = (
  env: Env,
  scheduledTime: number,
): Effect.Effect<void, unknown, HttpClient.HttpClient> =>
  Effect.gen(function* () {
    const evaluationId = `${env.APP_RELEASE}:${scheduledTime}`

    const alertConfig = {
      release: env.APP_RELEASE,
      environment: env.APP_ENVIRONMENT,
      fromEmail: env.ALERT_FROM_EMAIL,
      fromName: env.ALERT_FROM_NAME,
      toEmail: env.ALERT_TO_EMAIL,
      investigationUrl: env.CLOUDFLARE_INVESTIGATION_URL,
    }

    if (env.SLO_DRILL === 'fire-resolve') {
      yield* runDrill(env.SLO_STATE, env.EMAIL, evaluationId, alertConfig)
    } else {
      const result = yield* Effect.result(
        querySlos({
          accountId: env.CLOUDFLARE_ACCOUNT_ID,
          apiToken: env.CLOUDFLARE_API_TOKEN,
          apiDataset: env.API_ANALYTICS_DATASET,
          browserDataset: env.BROWSER_ANALYTICS_DATASET,
          release: env.APP_RELEASE,
          stage: env.APP_ENVIRONMENT,
          windowMinutes: 15,
        }),
      )

      yield* persistAndNotify(
        env.SLO_STATE,
        env.EMAIL,
        evaluate(Result.isFailure(result) ? 'query-failure' : result.success),
        evaluationId,
        alertConfig,
      )
    }
  })

const runtime = ManagedRuntime.make(FetchHttpClient.layer)

export default {
  scheduled(controller: ScheduledController, env: Env, context: ExecutionContext): void {
    context.waitUntil(runtime.runPromise(scheduled(env, controller.scheduledTime)))
  },
} satisfies ExportedHandler<Env>
