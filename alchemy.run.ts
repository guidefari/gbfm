import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import * as Redacted from 'effect/Redacted'
import type { NavigationLockDurableObject } from './apps/server/src/durable-objects/navigation-lock.do'
import type { SpotifyImportResolverDurableObject } from './apps/server/src/durable-objects/spotify-import-resolver.do'

export default Alchemy.Stack(
  'gbfm',
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack
    const isProduction = stack.stage === 'prod'
    const secret = (name: string, sourceName = name) => Redacted.make(process.env[sourceName] ?? '')

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
      crons: ['* * * * *'],
      env: {
        DB: db,
        USER_CONTENT: userContent,
        MIXES: mixes,
        SITEMAP: sitemap,
        REMINDERS: reminders,
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
        SpotifyClientId: secret('SpotifyClientId', 'SPOTIFY_CLIENT_ID'),
        SpotifyClientSecret: secret('SpotifyClientSecret', 'SPOTIFY_CLIENT_SECRET'),
        DatabaseHost: secret('DatabaseHost'),
        DatabaseUser: secret('DatabaseUser'),
        DatabasePassword: secret('DatabasePassword'),
        DatabasePort: secret('DatabasePort'),
        DatabaseName: secret('DatabaseName'),
        SENTRY_BACKEND_DSN: secret('SENTRY_BACKEND_DSN'),
        SENTRY_DSN: secret('SENTRY_BACKEND_DSN'),
        VITE_PUBLIC_SENTRY_DSN: secret('VITE_PUBLIC_SENTRY_DSN'),
        OTEL_EXPORTER_OTLP_ENDPOINT: secret('OTEL_EXPORTER_OTLP_ENDPOINT'),
        OTEL_EXPORTER_OTLP_HEADERS: secret('OTEL_EXPORTER_OTLP_HEADERS'),
        BETTER_AUTH_SECRET: secret('BETTER_AUTH_SECRET'),
        BETTER_AUTH_URL: secret('BETTER_AUTH_URL'),
        GBFM_ENCRYPTION_ROOT_KEY: secret('GBFM_ENCRYPTION_ROOT_KEY'),
        StorageProvider: process.env.StorageAccessKeyId ? 'r2' : secret('StorageProvider'),
        StorageEndpoint: secret('StorageEndpoint'),
        StorageRegion: secret('StorageRegion'),
        StorageAccessKeyId: secret('StorageAccessKeyId'),
        StorageSecretAccessKey: secret('StorageSecretAccessKey'),
        StorageSigningEndpoint: secret('StorageSigningEndpoint')
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
