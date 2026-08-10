import { Effect } from 'effect'
import { runApp } from './runtime'
import { SentryService } from './services/sentry.service'

// Step 8: the Hono app is gone -- initializeApp used to build and return it
// (AppType was Awaited<ReturnType<typeof initializeApp>>, threaded through
// createWebHandler as a parameter nothing actually called Hono methods on;
// confirmed by grep before removing it). All real route serving now lives
// entirely in apps/server/src/http/routes.ts's createWebHandler.
//
// The reminder loop and hourly sitemap regeneration that used to run here
// moved to the Worker composition seam (worker.ts): a Cron Trigger drives
// both via the scheduled handler, and reminder delivery is a queue consumer
// with a guarded claim instead of an in-process signal race. Graceful
// shutdown and signal handling are gone too -- Workers have no process
// lifecycle to hook.
const initializeApp = async () => {
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
