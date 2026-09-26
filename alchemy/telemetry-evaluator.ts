import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import * as Redacted from 'effect/Redacted'

import type { EmailResources } from './email'
import { privateSourceMaps, workerObservability } from './observability'
import type { StageConfig } from './stage'

export interface TelemetryEvaluatorInput {
  readonly config: StageConfig
  readonly email: Exclude<EmailResources, undefined>
  readonly analyticsApiToken: string
  readonly alertEmail: string
  readonly senderEmail: string
}

export const telemetryEvaluator = ({
  config,
  email,
  analyticsApiToken,
  alertEmail,
  senderEmail,
}: TelemetryEvaluatorInput) =>
  Effect.gen(function* () {
    const state = yield* Cloudflare.KV.Namespace('TelemetryEvaluatorState')
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? ''

    return yield* Cloudflare.Worker('TelemetryEvaluator', {
      main: './apps/telemetry-evaluator/src/worker.ts',
      workersDev: false,
      compatibility: { date: '2026-07-04', flags: ['nodejs_compat'] },
      build: privateSourceMaps,
      crons: ['*/5 * * * *'],
      observability: workerObservability(config.isProduction),
      env: {
        CLOUDFLARE_ACCOUNT_ID: accountId,
        CLOUDFLARE_API_TOKEN: Redacted.make(analyticsApiToken),
        API_ANALYTICS_DATASET: `gbfm_api_${config.stage}`,
        BROWSER_ANALYTICS_DATASET: `gbfm_www_${config.stage}`,
        APP_RELEASE: config.release,
        APP_ENVIRONMENT: config.stage,
        ALERT_FROM_EMAIL: senderEmail,
        ALERT_FROM_NAME: 'GBFM Observability',
        ALERT_TO_EMAIL: alertEmail,
        CLOUDFLARE_INVESTIGATION_URL: `https://dash.cloudflare.com/${accountId}/workers-and-pages`,
        SLO_STATE: state,
        EMAIL: email,
        ...(!config.isProduction && process.env.SLO_DRILL === 'fire-resolve'
          ? { SLO_DRILL: 'fire-resolve' }
          : undefined),
      },
    })
  })
