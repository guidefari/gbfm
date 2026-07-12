import { Duration, Effect, Schedule } from 'effect'
import { regenerateSitemap } from '@/routes/redirect/seo/sitemap.service'
import { runApp, runAppFork } from './runtime'
import { processPendingReminders, queryNextDueReminder } from './services/reminder-processor'
import { ReminderSignalService } from './services/reminder-signal.service'
import { SentryService } from './services/sentry.service'

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

// Registered by the entry point (src/index.ts) to dispose the Effect
// HttpRouter handler before the runtime shuts down.
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

// Step 8: the Hono app is gone -- initializeApp used to build and return it
// (AppType was Awaited<ReturnType<typeof initializeApp>>, threaded through
// createWebHandler as a parameter nothing actually called Hono methods on;
// confirmed by grep before removing it). All real route serving now lives
// entirely in apps/vps/src/http/routes.ts's createWebHandler.
const initializeApp = async () => {
  setupGracefulShutdown()

  runAppFork(reminderLoopEffect)
  runAppFork(sitemapRegenerationEffect)

  await runApp(
    Effect.gen(function* () {
      yield* SentryService
    }).pipe(
      Effect.tap(() => Effect.log('App initialized successfully')),
      Effect.tapError((error) => Effect.logError(`❌ Failed to initialize app: ${error}`))
    )
  )
}

await initializeApp()
