import type {
  D1Database,
  ExecutionContext,
  KVNamespace,
  MessageBatch,
  Queue,
  R2Bucket,
  ScheduledController
} from '@cloudflare/workers-types'
import { Effect } from 'effect'
import { DatabaseLayer } from '@/db/layer'
import { createWebHandler } from '@/http/routes'
import { regenerateSitemap } from '@/routes/redirect/seo/sitemap.service'
import { AppLayer } from '@/runtime/services'
import {
  claimReminder,
  findReminderById,
  queryDueReminders,
  sendClaimedReminder
} from '@/services/reminder-processor'
import { ReminderQueue, ReminderQueueLayer, type ReminderJob } from '@/services/reminder-queue'
import { SitemapCacheLayer } from '@/services/sitemap-cache'

// The only file that sees env, ExecutionContext, or a Cloudflare binding
// type. Every other module receives capabilities named in domain terms
// (Database, SitemapCache, ReminderQueue), never D1Database/KVNamespace/Queue
// directly.
export type ApiEnv = {
  readonly DB: D1Database
  readonly USER_CONTENT: R2Bucket
  readonly MIXES: R2Bucket
  readonly SITEMAP: KVNamespace
  readonly REMINDERS: Queue<ReminderJob>
}

const appServicesLive = (env: ApiEnv) =>
  AppLayer(DatabaseLayer(env.DB), SitemapCacheLayer(env.SITEMAP))

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
  Effect.provide(enqueueDueReminders, appServicesLive(env)).pipe(
    Effect.provide(reminderQueueLive(env))
  )

const runSitemapRegeneration = (env: ApiEnv) =>
  regenerateSitemap.pipe(
    Effect.asVoid,
    Effect.provide(appServicesLive(env)),
    Effect.catch((error) =>
      Effect.logError('[worker.scheduled] sitemap regeneration failed', { error })
    )
  )

// Claims a reminder with a guarded UPDATE ... WHERE status = 'pending'. Zero
// rows affected means a concurrent invocation already won the race -- that is
// a lost race, not a failure, so it is treated as a successful no-op rather
// than retried.
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
  }).pipe(Effect.provide(appServicesLive(env)))

export default {
  async fetch(request: Request, env: ApiEnv, _ctx: ExecutionContext): Promise<Response> {
    const webHandler = createWebHandler({ appServicesLive: appServicesLive(env) })
    try {
      return await webHandler.handler(request)
    } finally {
      await webHandler.dispose()
    }
  },

  async scheduled(_controller: ScheduledController, env: ApiEnv): Promise<void> {
    await Effect.runPromise(runSitemapRegeneration(env))
    await Effect.runPromise(runReminderSweep(env))
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
}
