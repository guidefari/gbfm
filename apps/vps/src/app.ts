import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import cron from 'node-cron'
import configureOpenAPI from '@/lib/configure-open-api'
import createApp from '@/lib/create-app'
import auth from '@/routes/auth/auth.index'
import betterAuthRoutes from '@/routes/auth/better-auth.routes'
import content from '@/routes/content/content.index'
import email from '@/routes/email/email.index'
import favorites from '@/routes/favorites/favorites.index'
import musicReminders from '@/routes/music-reminders/music-reminders.index'
import publication from '@/routes/publication/publication.index'
import rss from '@/routes/rss/rss.index'
import share from '@/routes/share/share.index'
import spotify from '@/routes/spotify/spotify.index'
import upload from '@/routes/upload/upload.index'
import { db } from './db'
import { runApp } from './runtime'
import { processPendingReminders } from './services/reminder-processor'

const app = createApp()

configureOpenAPI(app)

app.route('/api/auth', betterAuthRoutes)
app.route('/favorites', favorites)
app.route('/auth', auth)
app.route('/content', content)
app.route('/email', email)
app.route('/publication', publication)
app.route('/share', share)
app.route('/spotify', spotify)
app.route('/upload', upload)
app.route('/music-reminders', musicReminders)
app.route('', rss)

// Health check endpoint
app.get('/health', async (c) => {
  try {
    await db.execute(sql.raw('SELECT 1'))
    return c.json({ dbConnected: true })
  } catch {
    return c.json({ dbConnected: false }, 500)
  }
})

// Initialize cron job for music reminder emails
// Runs every minute
cron.schedule('* * * * *', async () => {
  console.log('🎵 Running music reminder processor...')

  try {
    await runApp(
      processPendingReminders.pipe(
        Effect.catchAll((error) =>
          Effect.logError(`Cron job failed: ${error.message}`)
        )
      )
    )
    console.log('✅ Music reminder processing completed')
  } catch (error) {
    console.error('❌ Critical cron error:', error)
  }
})

console.log('🎵 Music reminder cron job initialized (runs every minute)')

// Graceful shutdown handler
// Ensures proper cleanup of resources (database connections, etc.) on shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`)

  try {
    // Import disposeRuntime to clean up all services
    const { disposeRuntime } = await import('./runtime')
    await disposeRuntime()
    console.log('✅ Runtime disposed successfully')
  } catch (error) {
    console.error('❌ Error during shutdown:', error)
    process.exit(1)
  }

  process.exit(0)
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export type AppType = typeof app

export default app
