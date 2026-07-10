import { Duration, Effect, Schedule } from 'effect'
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
import search from '@/routes/search/search.index'
import shows from '@/routes/shows/show.index'
import spotify from '@/routes/spotify/spotify.index'
import upload from '@/routes/upload/upload.index'
import uploadMultipart from '@/routes/upload-multipart/upload-multipart.index'
import betterAuthRoutes from '@/routes/user/better-auth.routes'
import user from '@/routes/user/user.index'
import { regenerateSitemap } from './routes/redirect/seo/sitemap'
import { runApp, runAppFork } from './runtime'
import { processPendingReminders, queryNextDueReminder } from './services/reminder-processor'
import { ReminderSignalService } from './services/reminder-signal.service'
import { SentryService } from './services/sentry.service'

export const honoAppEffect = Effect.gen(function* () {
  yield* SentryService
  const app = yield* createAppEffect

  configureOpenAPI(app)

  app.route('/api/admin', admin)
  app.route('/api/favorites', favorites)
  app.route('/api/invite', invite)
  app.route('/api/profile', profile)
  app.route('/api/resolve', resolve)
  app.route('/api/user', user)
  app.route('/api/content', content)
  app.route('/api/search', search)
  app.route('/api/email', email)
  app.route('/api/newsletter', newsletter)
  app.route('/api/shows', shows)
  app.route('/api/spotify', spotify)
  app.route('/api/file-manager', fileManager)
  app.route('/api/upload', upload)
  app.route('/api/upload', uploadMultipart)
  app.route('/api/music', music)
  app.route('/api/music-reminders', musicReminders)

  app.route('/auth', betterAuthRoutes)
  app.route('/s', shareRouter)
  app.route('', rss)
  app.route('', seoRouter)

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

let gracefulShutdownConfigured = false

export const setupGracefulShutdown = (disposeHttp?: () => Promise<void>) => {
  if (gracefulShutdownConfigured) return

  gracefulShutdownConfigured = true

  const shutdown = async (signal: string) => {
    console.log(`Graceful shutdown initiated via ${signal}`)

    try {
      if (disposeHttp) {
        await disposeHttp()
      }

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

export const startBackgroundEffects = () => {
  void runAppFork(reminderLoopEffect)
  void runAppFork(sitemapRegenerationEffect)
}

const initializeHonoApp = async () => {
  return await runApp(
    honoAppEffect.pipe(
      Effect.tapError((error) => Effect.logError(`❌ Failed to initialize app: ${error}`))
    )
  )
}

export type AppType = Awaited<ReturnType<typeof initializeHonoApp>>

export default await initializeHonoApp()
