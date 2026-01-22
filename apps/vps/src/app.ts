import { sql } from 'drizzle-orm'
import { Effect, Schedule } from 'effect'
import configureOpenAPI from '@/lib/configure-open-api'
import { createAppEffect } from '@/lib/create-app'
import content from '@/routes/content/content.index'
import email from '@/routes/email/email.index'
import favorites from '@/routes/favorites/favorites.index'
import musicReminders from '@/routes/music-reminders/music-reminders.index'
import publication from '@/routes/publication/publication.index'
import rss from '@/routes/rss/rss.index'
import share from '@/routes/share/share.index'
import spotify from '@/routes/spotify/spotify.index'
import upload from '@/routes/upload/upload.index'
import betterAuthRoutes from '@/routes/user/better-auth.routes'
import user from '@/routes/user/user.index'
import { db } from './db'
import { runApp, runAppFork } from './runtime'
import { processPendingReminders } from './services/reminder-processor'

const healthCheckEffect = Effect.tryPromise({
  try: () => db.execute(sql.raw('SELECT 1')),
  catch: () => new Error('Database connection failed')
})

const setupRoutesEffect = Effect.gen(function* () {
  const app = yield* createAppEffect

  configureOpenAPI(app)

  app.route('/auth', betterAuthRoutes)
  app.route('/favorites', favorites)
  app.route('/user', user)
  app.route('/content', content)
  app.route('/email', email)
  app.route('/publication', publication)
  app.route('/share', share)
  app.route('/spotify', spotify)
  app.route('/upload', upload)
  app.route('/music-reminders', musicReminders)
  app.route('', rss)

  app.get('/health', async (c) => {
    const result = await runApp(healthCheckEffect.pipe(Effect.either))

    if (result._tag === 'Left') {
      return c.json({ dbConnected: false }, 500)
    }

    return c.json({ dbConnected: true })
  })

  return app
})

const cronJobEffect = processPendingReminders.pipe(
  // Log success BEFORE potentially recovering from error
  Effect.tap(() => Effect.log('✅ Music reminder processing completed')),
  // Catch and log any errors, continuing the loop
  Effect.catchAll((error) =>
    Effect.logError(
      `Cron job failed: ${error instanceof Error ? error.message : String(error)}`
    )
  ),
  // Repeat every 30 seconds
  Effect.repeat(Schedule.spaced('30 seconds'))
)

const mainEffect = Effect.gen(function* () {
  // Setup and return app
  return yield* setupRoutesEffect
})

const setupGracefulShutdown = () => {
  const shutdown = async (signal: string) => {
    Effect.logInfo(`Graceful shutdown initiated via ${signal}`)

    try {
      const { disposeRuntime } = await import('./runtime')
      await disposeRuntime()
      Effect.logInfo('Runtime disposed successfully')
    } catch (error) {
      Effect.logError('Error during shutdown', {
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

  runAppFork(cronJobEffect)

  return await runApp(
    mainEffect.pipe(
      Effect.tap(() => Effect.log('App initialized successfully')),
      Effect.tapError((error) =>
        Effect.logError(`❌ Failed to initialize app: ${error}`)
      )
    )
  )
}

export type AppType = Awaited<ReturnType<typeof initializeApp>>

export default await initializeApp()
