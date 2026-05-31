import { sql } from 'drizzle-orm'
import { Data, Duration, Effect, Schedule } from 'effect'
import type { Context } from 'hono'
import configureOpenAPI from '@/lib/configure-open-api'
import { createAppEffect } from '@/lib/create-app'
import admin from '@/routes/admin/admin.index'
import content from '@/routes/content/content.index'
import email from '@/routes/email/email.index'
import favorites from '@/routes/favorites/favorites.index'
import fileManager from '@/routes/file-manager/file-manager.index'
import invite from '@/routes/invite/invite.index'
import music from '@/routes/music/music.index'
import musicReminders from '@/routes/music-reminders/music-reminders.index'
import newsletter from '@/routes/newsletter/newsletter.index'
import profile from '@/routes/profile/profile.index'
import { seoRouter, shareRouter } from '@/routes/redirect/redirect.index'
import resolve from '@/routes/resolve/resolve.index'
import rss from '@/routes/rss/rss.index'
import shows from '@/routes/shows/show.index'
import spotify from '@/routes/spotify/spotify.index'
import upload from '@/routes/upload/upload.index'
import betterAuthRoutes from '@/routes/user/better-auth.routes'
import user from '@/routes/user/user.index'
import { db } from './db'
import { regenerateSitemap } from './routes/redirect/seo/sitemap'
import { runApp, runAppFork } from './runtime'
import { processPendingReminders, queryNextDueReminder } from './services/reminder-processor'
import { ReminderSignalService } from './services/reminder-signal.service'
import { SentryService } from './services/sentry.service'

class HealthCheckError extends Data.TaggedError('HealthCheckError')<{
  cause?: unknown
}> {}

const healthCheckEffect = Effect.tryPromise({
  try: () => db.execute(sql.raw('SELECT 1')),
  catch: (cause) => new HealthCheckError({ cause })
})

const READINESS_CACHE_MS = 5_000
let readinessCache: { checkedAt: number; status: 200 | 500 } | undefined

const setupRoutesEffect = Effect.gen(function* () {
  yield* SentryService
  const app = yield* createAppEffect

  configureOpenAPI(app)

  app.route('/admin', admin)
  app.route('/auth', betterAuthRoutes)
  app.route('/favorites', favorites)
  app.route('/invite', invite)
  app.route('/profile', profile)
  app.route('/resolve', resolve)
  app.route('/user', user)
  app.route('/content', content)
  app.route('/email', email)
  app.route('/newsletter', newsletter)
  app.route('/s', shareRouter)
  app.route('/shows', shows)
  app.route('/spotify', spotify)
  app.route('/file-manager', fileManager)
  app.route('/upload', upload)
  app.route('/music', music)
  app.route('/music-reminders', musicReminders)
  app.route('', rss)
  app.route('', seoRouter)

  app.get('/health/live', (c) => c.json({ ok: true }, 200))

  const readinessHealthRoute = async (c: Context) => {
    const cache = readinessCache
    const cachedStatus = cache && Date.now() - cache.checkedAt < READINESS_CACHE_MS

    if (cachedStatus) {
      return c.json({ dbConnected: cache.status === 200 }, cache.status)
    }

    const program = healthCheckEffect.pipe(
      Effect.map(() => ({ data: { dbConnected: true }, status: 200 as const })),
      Effect.catch(() => Effect.succeed({ data: { dbConnected: false }, status: 500 as const }))
    )

    const result = await runApp(program)
    readinessCache = {
      checkedAt: Date.now(),
      status: result.status
    }
    return c.json(result.data, result.status)
  }

  app.get('/health/ready', readinessHealthRoute)
  app.get('/health', readinessHealthRoute)

  return app
})

// Recovery interval caps the sleep so stalled/failed reminders are always retried
const RECOVERY_INTERVAL_MS = 5 * 60 * 1000

const reminderLoopEffect = Effect.gen(function* () {
  const { await: awaitSignal } = yield* ReminderSignalService

  const nextDate = yield* queryNextDueReminder.pipe(Effect.catch(() => Effect.succeed(null)))

  const msUntilNext = nextDate ? Math.max(0, nextDate.getTime() - Date.now()) : RECOVERY_INTERVAL_MS
  const sleepMs = Math.min(msUntilNext, RECOVERY_INTERVAL_MS)

  yield* Effect.race(Effect.sleep(Duration.millis(sleepMs)), awaitSignal)

  yield* processPendingReminders
}).pipe(
  Effect.catch((error) =>
    Effect.logError(
      `Reminder loop failed: ${error instanceof Error ? error.message : String(error)}`
    )
  ),
  Effect.repeat(Schedule.forever)
)

const sitemapRegenerationEffect = regenerateSitemap.pipe(
  Effect.catch((error) =>
    Effect.logError(
      `Sitemap regeneration failed: ${error instanceof Error ? error.message : String(error)}`
    )
  ),
  Effect.repeat(Schedule.spaced('1 hours'))
)

const mainEffect = setupRoutesEffect

const setupGracefulShutdown = () => {
  const shutdown = async (signal: string) => {
    console.log(`Graceful shutdown initiated via ${signal}`)

    try {
      const { disposeRuntime } = await import('./runtime')
      await disposeRuntime()
      console.log('Runtime disposed successfully')
    } catch (error) {
      console.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error)
      })
      process.exit(1)
    }

    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

// Initialize app with Effect
const initializeApp = async () => {
  setupGracefulShutdown()

  runAppFork(reminderLoopEffect)
  runAppFork(sitemapRegenerationEffect)

  return await runApp(
    mainEffect.pipe(
      Effect.tap(() => Effect.log('App initialized successfully')),
      Effect.tapError((error) => Effect.logError(`❌ Failed to initialize app: ${error}`))
    )
  )
}

export type AppType = Awaited<ReturnType<typeof initializeApp>>

export default await initializeApp()
