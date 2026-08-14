import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import type { NavigationLockDurableObject } from '../apps/server/src/durable-objects/navigation-lock.do'
import type { SpotifyImportResolverDurableObject } from '../apps/server/src/durable-objects/spotify-import-resolver.do'
import type { EmailDeploymentConfig } from '../apps/server/src/email-deployment-config'
import {
  maintenanceSweepCron,
  reminderSweepCron,
  sitemapRegenerationCron
} from '../apps/server/src/scheduled'
import type { EmailResources } from './email'
import type { SecretBindings } from './secrets'
import { hostname, type StageConfig } from './stage'
import type { Storage } from './storage'

export interface ApiWorkerInput {
  readonly config: StageConfig
  readonly store: Storage
  readonly secrets: SecretBindings
  readonly email: EmailResources
  readonly emailConfig: EmailDeploymentConfig
}

export const apiWorker = ({ config, store, secrets, email, emailConfig }: ApiWorkerInput) =>
  Effect.gen(function* () {
    const sentryDsn = secrets.SENTRY_BACKEND_DSN
    if (sentryDsn === undefined) {
      return yield* Effect.die(new Error('SENTRY_BACKEND_DSN secret is missing'))
    }

    const api = yield* Cloudflare.Worker('Api', {
      main: './apps/server/src/worker.ts',
      ...hostname(config, 'api.goosebumps.fm'),
      compatibility: { date: '2026-08-09', flags: ['nodejs_compat'] },
      crons: [reminderSweepCron, sitemapRegenerationCron, maintenanceSweepCron],
      env: {
        DB: store.db,
        USER_CONTENT: store.userContent,
        MIXES: store.mixes,
        SITEMAP: store.sitemap,
        REMINDERS: store.reminders,
        ...(email === undefined ? undefined : { EMAIL: email }),
        EMAIL_SENDER: emailConfig.emailSender,
        EMAIL_TRANSPORT_MODE: emailConfig.transport,
        NAVIGATION_LOCK: Cloudflare.DurableObject<NavigationLockDurableObject>('NavigationLock', {
          className: 'NavigationLockDurableObject'
        }),
        SPOTIFY_IMPORT_RESOLVER: Cloudflare.DurableObject<SpotifyImportResolverDurableObject>(
          'SpotifyImportResolver',
          {
            className: 'SpotifyImportResolverDurableObject'
          }
        ),
        APP_STAGE: config.stage,
        USER_CONTENT_BUCKET_NAME: store.userContent.bucketName,
        MIXES_BUCKET_NAME: store.mixes.bucketName,
        SENTRY_ENVIRONMENT: config.stage,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? '',
        ...secrets,
        SENTRY_DSN: sentryDsn,
        R2AccountId: store.userContent.accountId
      }
    })

    yield* Cloudflare.Queues.Consumer('ReminderConsumer', {
      queueId: store.reminders.queueId,
      scriptName: api.workerName
    })

    return api
  })
