import { Duration, Effect, Schedule } from 'effect'
import configureOpenAPI from '@/lib/configure-open-api'
import { createAppEffect } from '@/lib/create-app'
import content from '@/routes/content/content.index'
import email from '@/routes/email/email.index'
import fileManager from '@/routes/file-manager/file-manager.index'
import musicReminders from '@/routes/music-reminders/music-reminders.index'
import { seoRouter, shareRouter } from '@/routes/redirect/redirect.index'
import rss from '@/routes/rss/rss.index'
import shows from '@/routes/shows/show.index'
import spotify from '@/routes/spotify/spotify.index'
import upload from '@/routes/upload/upload.index'
import uploadMultipart from '@/routes/upload-multipart/upload-multipart.index'
import user from '@/routes/user/user.index'
import { regenerateSitemap } from './routes/redirect/seo/sitemap'
import { runApp, runAppFork } from './runtime'
import { processPendingReminders, queryNextDueReminder } from './services/reminder-processor'
import { ReminderSignalService } from './services/reminder-signal.service'
import { SentryService } from './services/sentry.service'

const setupRoutesEffect = Effect.gen(function* () {
  yield* SentryService
  const app = yield* createAppEffect

  configureOpenAPI(app)

  app.route('/api/user', user)
  app.route('/api/content', content)
  app.route('/api/email', email)
  app.route('/api/shows', shows)
  app.route('/api/spotify', spotify)
  app.route('/api/file-manager', fileManager)
  app.route('/api/upload', upload)
  app.route('/api/upload', uploadMultipart)
  app.route('/api/music-reminders', musicReminders)

  // Kept at root, not under /api: these are externally-referenced public URLs.
  // /auth and /health are handled by the Effect router directly
  // (apps/vps/src/http/routes.ts, steps 2c/3a) -- not mounted here.
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

const mainEffect = setupRoutesEffect

// Registered by the entry point (src/index.ts) to dispose the Effect
// HttpRouter handler before the runtime shuts down. No-op until Step 2b wires
// the entry point to serve through it (docs/migration-effect-http-api.md).
let disposeWebHandler: (() => Promise<void>) | undefined

export const onShutdown = (dispose: () => Promise<void>) => {
  disposeWebHandler = dispose
}

const setupGracefulShutdown = () => {
  const shutdown = async (signal: string) => {
    console.log(`Graceful shutdown initiated via ${signal}`)

    try {
      await disposeWebHandler?.()
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
