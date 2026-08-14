import type {
  D1Database,
  DurableObjectNamespace,
  ExecutionContext,
  KVNamespace,
  MessageBatch,
  Queue,
  R2Bucket,
  ScheduledController,
  SendEmail
} from '@cloudflare/workers-types'
import * as Sentry from '@sentry/cloudflare'
import type { ErrorEvent, TracesSamplerSamplingContext, TransactionEvent } from '@sentry/core'
import { traceSampleRate } from '@gbfm/core/observability/trace-sampling'
import { Effect, Layer } from 'effect'
import type { NavigationLockDurableObject } from '@/durable-objects/navigation-lock.do'
import type { SpotifyImportResolverDurableObject } from '@/durable-objects/spotify-import-resolver.do'
import { DatabaseLayer } from '@/db/layer'
import { DatabaseError, getErrorMessage } from '@/errors'
import { sanitizeDatabaseSpan } from '@/lib/database-telemetry'
import { hasLocalSentryContext, shouldEnableSentry } from '@/lib/sentry'
import { createWebHandler } from '@/http/routes'
import { regenerateSitemap } from '@/routes/redirect/seo/sitemap.service'
import { AppLayer } from '@/runtime/services'
import {
  WorkerSentryEnabledLive,
  WorkerSentryEnv,
  WorkerTracingLive
} from '@/runtime/sentry-worker'
import { canonicalNavigationLockName, NavigationLock } from '@/services/navigation-lock'
import {
  canonicalSpotifyImportResolverName,
  SpotifyImportResolver
} from '@/services/spotify-import-resolver.service'
import {
  claimReminder,
  findReminderById,
  queryDueReminders,
  sendClaimedReminder
} from '@/services/reminder-processor'
import { ReminderQueue, ReminderQueueLayer, type ReminderJob } from '@/services/reminder-queue'
import { cleanupExpiredQrPdfs } from '@/services/qr-cache-cleanup'
import { SitemapCacheLayer } from '@/services/sitemap-cache'
import { dispatchScheduledJob } from '@/scheduled'
import { BlueskySyncService } from '@/services/bluesky-sync.service'
import { NavigationRetentionService } from '@/services/navigation-retention.service'
import { SentryServiceLayer } from '@/services/sentry.service'
import { CloudflareEmailTransportLayer } from '@/services/cloudflare-email.adapter'
import {
  RecordingEmailTransportLayer,
  UnconfiguredEmailTransportLayer
} from '@/services/email-transport.service'
import { R2ObjectStoreClientLayer } from '@/services/storage/r2-object-store-client'
import {
  WorkerConfigServiceLayerEffect,
  type WorkerConfigBindings
} from '@/services/config.service'
import { resolveSecretBindings } from '@/services/secrets-store.service'

export { NavigationLockDurableObject } from '@/durable-objects/navigation-lock.do'
export { SpotifyImportResolverDurableObject } from '@/durable-objects/spotify-import-resolver.do'

// The only file that sees env, ExecutionContext, or a Cloudflare binding
// type. Every other module receives capabilities named in domain terms
// (Database, SitemapCache, ReminderQueue), never D1Database/KVNamespace/Queue
// directly.
export type ApiEnv = WorkerConfigBindings & {
  readonly DB: D1Database
  readonly USER_CONTENT: R2Bucket
  readonly MIXES: R2Bucket
  readonly SITEMAP: KVNamespace
  readonly REMINDERS: Queue<ReminderJob>
  readonly EMAIL?: SendEmail
  readonly EMAIL_TRANSPORT_MODE?: 'cloudflare' | 'recording'
  readonly NAVIGATION_LOCK: DurableObjectNamespace<NavigationLockDurableObject>
  readonly SPOTIFY_IMPORT_RESOLVER: DurableObjectNamespace<SpotifyImportResolverDurableObject>
  readonly SENTRY_DSN?: string
  readonly SENTRY_ENVIRONMENT?: string
}

const workerSentryEnvLive = (env: ApiEnv) =>
  Layer.succeed(WorkerSentryEnv, { dsn: env.SENTRY_DSN, environment: env.SENTRY_ENVIRONMENT })

const workerSentryServiceLive = (env: ApiEnv) =>
  SentryServiceLayer.pipe(
    Layer.provide(WorkerSentryEnabledLive),
    Layer.provide(workerSentryEnvLive(env))
  )

const navigationLockError = (operation: string, cause: unknown) =>
  new DatabaseError({
    message: `Failed to ${operation} navigation lock: ${getErrorMessage(cause)}`,
    operation,
    table: 'navigation_sessions'
  })

const navigationLockLive = (env: ApiEnv) =>
  Layer.succeed(NavigationLock, {
    decide: (identity, request) =>
      Effect.tryPromise({
        try: async () => {
          const canonicalName = canonicalNavigationLockName(identity)
          const stub = env.NAVIGATION_LOCK.get(env.NAVIGATION_LOCK.idFromName(canonicalName))
          await stub.setIdentity(canonicalName)
          return await stub.decide(request)
        },
        catch: (error) => navigationLockError('decide', error)
      }),
    commit: (identity, input) =>
      Effect.tryPromise({
        try: async () => {
          const canonicalName = canonicalNavigationLockName(identity)
          const stub = env.NAVIGATION_LOCK.get(env.NAVIGATION_LOCK.idFromName(canonicalName))
          await stub.commit(input)
        },
        catch: (error) => navigationLockError('commit', error)
      }),
    sync: (identity, input) =>
      Effect.tryPromise({
        try: async () => {
          const canonicalName = canonicalNavigationLockName(identity)
          const stub = env.NAVIGATION_LOCK.get(env.NAVIGATION_LOCK.idFromName(canonicalName))
          await stub.sync(input)
        },
        catch: (error) => navigationLockError('sync', error)
      }),
    reset: (identity) =>
      Effect.tryPromise({
        try: async () => {
          const canonicalName = canonicalNavigationLockName(identity)
          const stub = env.NAVIGATION_LOCK.get(env.NAVIGATION_LOCK.idFromName(canonicalName))
          await stub.reset()
        },
        catch: (error) => navigationLockError('reset', error)
      })
  })

const spotifyImportResolverError = (operation: string, cause: unknown) =>
  new DatabaseError({
    message: `Failed to ${operation} Spotify import resolver: ${getErrorMessage(cause)}`,
    operation,
    table: 'music_entity_links'
  })

const spotifyImportResolverLive = (env: ApiEnv) =>
  Layer.succeed(SpotifyImportResolver, {
    resolveTrack: (track) =>
      Effect.tryPromise({
        try: async () => {
          const canonicalName = canonicalSpotifyImportResolverName('track', track.trackUrl)
          const stub = env.SPOTIFY_IMPORT_RESOLVER.get(
            env.SPOTIFY_IMPORT_RESOLVER.idFromName(canonicalName)
          )
          return await stub.resolveTrack(track)
        },
        catch: (error) => spotifyImportResolverError('resolve track', error)
      }),
    resolvePlaylist: (playlist, coverImageUrl, curatorId) =>
      Effect.tryPromise({
        try: async () => {
          const canonicalName = canonicalSpotifyImportResolverName('playlist', playlist.playlistUrl)
          const stub = env.SPOTIFY_IMPORT_RESOLVER.get(
            env.SPOTIFY_IMPORT_RESOLVER.idFromName(canonicalName)
          )
          return await stub.resolvePlaylist(playlist, coverImageUrl, curatorId)
        },
        catch: (error) => spotifyImportResolverError('resolve playlist', error)
      })
  })

const appServicesLive = (env: ApiEnv) => {
  const configLive = WorkerConfigServiceLayerEffect(
    resolveSecretBindings(env).pipe(
      Effect.map((secrets) => ({ ...env, ...secrets })),
      // An unreadable secret cannot degrade to blank config: that would boot a
      // Worker with no database password and surface as confusing auth errors.
      Effect.orDie
    )
  )
  const objectStoreLive = R2ObjectStoreClientLayer({
    userContent: env.USER_CONTENT,
    mixes: env.MIXES
  }).pipe(Layer.provide(configLive))

  return AppLayer({
    database: DatabaseLayer(env.DB),
    sitemapCache: SitemapCacheLayer(env.SITEMAP),
    navigationLock: navigationLockLive(env),
    spotifyImportResolver: spotifyImportResolverLive(env),
    sentry: workerSentryServiceLive(env),
    tracing: WorkerTracingLive,
    config: configLive,
    objectStore: objectStoreLive,
    emailTransport:
      env.EMAIL !== undefined
        ? CloudflareEmailTransportLayer(env.EMAIL)
        : env.EMAIL_TRANSPORT_MODE === 'recording'
          ? RecordingEmailTransportLayer
          : UnconfiguredEmailTransportLayer
  })
}

const sentryOptions = (env: ApiEnv) => {
  const dsn = env.SENTRY_DSN ?? ''
  const environment = env.SENTRY_ENVIRONMENT ?? 'development'

  if (!shouldEnableSentry(dsn, environment)) return undefined

  return {
    dsn,
    environment,
    tracesSampler: ({
      inheritOrSampleWith,
      name,
      normalizedRequest
    }: TracesSamplerSamplingContext) =>
      inheritOrSampleWith(traceSampleRate({ name, url: normalizedRequest?.url })),

    sendDefaultPii: false,
    enableLogs: true,
    beforeSendSpan: sanitizeDatabaseSpan,
    beforeSend: (event: ErrorEvent) => (hasLocalSentryContext(event) ? null : event),
    beforeSendTransaction: (event: TransactionEvent) =>
      hasLocalSentryContext(event) ? null : event
  }
}

const reminderQueueLive = (env: ApiEnv) => ReminderQueueLayer(env.REMINDERS)

const enqueueDueReminders = Effect.gen(function* () {
  const dueReminders = yield* queryDueReminders
  const reminderQueue = yield* ReminderQueue

  yield* Effect.forEach(
    dueReminders,
    (reminder) =>
      reminderQueue.enqueue({
        reminderId: reminder.id,
        idempotencyKey: reminder.id,
        dueAt: reminder.reminderDate.getTime()
      }),
    { concurrency: 5 }
  )
}).pipe(
  Effect.catch((error) => Effect.logError('[worker.scheduled] reminder sweep failed', { error }))
)

const runReminderSweep = (env: ApiEnv) =>
  // oxlint-disable-next-line effecttsgo/strict-effect-provide -- Scheduled dispatch is an Effect application entry point.
  Effect.provide(enqueueDueReminders, appServicesLive(env)).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- Scheduled dispatch is an Effect application entry point.
    Effect.provide(reminderQueueLive(env))
  )

const runSitemapRegeneration = (env: ApiEnv) =>
  regenerateSitemap.pipe(
    Effect.asVoid,
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- Scheduled dispatch is an Effect application entry point.
    Effect.provide(appServicesLive(env)),
    Effect.catch((error) =>
      Effect.logError('[worker.scheduled] sitemap regeneration failed', { error })
    )
  )

// Ported from the AWS `BlueskySyncTask`. Each sweep is isolated so a failure
// in one still lets the other run, which is what the standalone task did.
const runMaintenanceSweep = (env: ApiEnv) =>
  Effect.gen(function* () {
    const retention = yield* NavigationRetentionService
    const report = yield* retention.sweepExpiredAnonymousSessions(new Date())
    yield* Effect.logInfo('[worker.scheduled] navigation retention sweep finished', report)
  }).pipe(
    Effect.catch((error) =>
      Effect.logError('[worker.scheduled] navigation retention sweep failed', { error })
    ),
    Effect.andThen(
      Effect.gen(function* () {
        const sync = yield* BlueskySyncService
        const report = yield* sync.syncScheduled()
        yield* Effect.logInfo('[worker.scheduled] bluesky sync finished', report)
      }).pipe(
        Effect.catch((error) =>
          Effect.logError('[worker.scheduled] bluesky sync failed', { error })
        )
      )
    ),
    // Replaces the S3 lifecycle rule that expired `qr-pdfs/` after a day. R2
    // lifecycle rules cannot target a prefix, so the sweep does it instead.
    Effect.andThen(
      cleanupExpiredQrPdfs.pipe(
        Effect.tap((report) =>
          Effect.logInfo('[worker.scheduled] qr pdf cleanup finished', report)
        ),
        Effect.catch((error) =>
          Effect.logError('[worker.scheduled] qr pdf cleanup failed', { error })
        ),
        Effect.asVoid
      )
    ),
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- Scheduled dispatch is an Effect application entry point.
    Effect.provide(appServicesLive(env))
  )

// Claims a reminder with a guarded UPDATE from PENDING or FAILED. FAILED is
// retry-eligible after a prior delivery invocation returns an error. Zero rows
// means another invocation owns the reminder, so this delivery can be acked.
const processReminderMessage = (env: ApiEnv, job: ReminderJob) =>
  Effect.gen(function* () {
    const claim = yield* claimReminder(job.reminderId)
    if (!claim.claimed) {
      return
    }

    const reminder = yield* findReminderById(job.reminderId)
    if (!reminder) {
      return
    }

    yield* sendClaimedReminder(reminder)
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- Queue dispatch is an Effect application entry point.
  }).pipe(Effect.provide(appServicesLive(env)))

export default Sentry.withSentry<ApiEnv, ReminderJob>(sentryOptions, {
  async fetch(request: Request, env: ApiEnv, _ctx: ExecutionContext): Promise<Response> {
    const webHandler = createWebHandler({ appServicesLive: appServicesLive(env) })
    try {
      return await webHandler.handler(request)
    } finally {
      await webHandler.dispose()
    }
  },

  scheduled(controller: ScheduledController, env: ApiEnv): Promise<void> {
    return dispatchScheduledJob(controller.cron, {
      regenerateSitemap: () => Effect.runPromise(runSitemapRegeneration(env)),
      sweepReminders: () => Effect.runPromise(runReminderSweep(env)),
      runMaintenance: () => Effect.runPromise(runMaintenanceSweep(env))
    })
  },

  async queue(batch: MessageBatch<ReminderJob>, env: ApiEnv): Promise<void> {
    for (const message of batch.messages) {
      const exit = await Effect.runPromiseExit(processReminderMessage(env, message.body))
      if (exit._tag === 'Success') {
        message.ack()
      } else {
        message.retry()
      }
    }
  }
})
