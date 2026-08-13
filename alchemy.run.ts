import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import { secretsStore } from './infra/secrets'
import { reminderSweepCron, sitemapRegenerationCron } from './apps/server/src/scheduled'
import type { NavigationLockDurableObject } from './apps/server/src/durable-objects/navigation-lock.do'
import type { SpotifyImportResolverDurableObject } from './apps/server/src/durable-objects/spotify-import-resolver.do'
import { emailDeploymentConfig } from './apps/server/src/email-deployment-config'

export default Alchemy.Stack(
  'gbfm',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const isProduction = stack.stage === 'prod'
    const isLocalDev = yield* Alchemy.ALCHEMY_DEV
    const secrets = yield* secretsStore
    const emailConfig = emailDeploymentConfig({
      stage: stack.stage,
      testRecipient: process.env.EMAIL_TEST_RECIPIENT,
      localDev: isLocalDev
    })

    const email = yield* Effect.gen(function* () {
      if (emailConfig.transport === 'recording') return undefined

      const routing = yield* Cloudflare.Email.Routing('EmailRouting', { zone: 'goosebumps.fm' })
      yield* Cloudflare.Email.SendingSubdomain('EmailSending', {
        zoneId: routing.zoneId,
        name: emailConfig.sendingDomain
      })
      return isProduction
        ? yield* Cloudflare.Email.SendEmail('EMAIL', {
            allowedSenderAddresses: [emailConfig.emailSender]
          })
        : yield* Cloudflare.Email.SendEmail('EMAIL', {
            allowedSenderAddresses: [emailConfig.emailSender],
            destinationAddress: emailConfig.destinationAddress
          })
    })

    const db = yield* Cloudflare.D1.Database('Database', {
      migrationsDir: './apps/server/drizzle-d1'
    })

    const userContent = yield* Cloudflare.R2.Bucket('UserContent')
    const mixes = yield* Cloudflare.R2.Bucket('Mixes')

    const sitemap = yield* Cloudflare.KV.Namespace('Sitemap')

    const reminders = yield* Cloudflare.Queues.Queue('Reminders')

    const api = yield* Cloudflare.Worker('Api', {
      main: './apps/server/src/worker.ts',
      ...(isProduction ? { domain: 'api.goosebumps.fm' } : { url: true }),
      compatibility: { date: '2026-08-09', flags: ['nodejs_compat'] },
      crons: [reminderSweepCron, sitemapRegenerationCron],
      env: {
        DB: db,
        USER_CONTENT: userContent,
        MIXES: mixes,
        SITEMAP: sitemap,
        REMINDERS: reminders,
        ...(email === undefined ? {} : { EMAIL: email }),
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
        APP_STAGE: stack.stage,
        USER_CONTENT_BUCKET_NAME: userContent.bucketName,
        MIXES_BUCKET_NAME: mixes.bucketName,
        SENTRY_ENVIRONMENT: stack.stage,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? '',
        ...secrets,
        SENTRY_DSN: secrets.SENTRY_BACKEND_DSN,
        StorageProvider: 'r2',
        R2AccountId: userContent.accountId
      }
    })

    yield* Cloudflare.Queues.Consumer('ReminderConsumer', {
      queueId: reminders.queueId,
      scriptName: api.workerName
    })

    return {
      apiUrl: api.url,
      apiDomains: api.domains,
      databaseName: db.databaseName,
      userContentBucketName: userContent.bucketName,
      mixesBucketName: mixes.bucketName
    }
  })
)
