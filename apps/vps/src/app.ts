import { sql } from 'drizzle-orm'
import configureOpenAPI from '@/lib/configure-open-api'
import createApp from '@/lib/create-app'
import auth from '@/routes/auth/auth.index'
import content from '@/routes/content/content.index'
import email from '@/routes/email/email.index'
import publication from '@/routes/publication/publication.index'
import rss from '@/routes/rss/rss.index'
import share from '@/routes/share/share.index'
import spotify from '@/routes/spotify/spotify.index'
import upload from '@/routes/upload/upload.index'
import { db } from './db'

const app = createApp()

configureOpenAPI(app)

app.route('/auth', auth)
app.route('/content', content)
app.route('/email', email)
app.route('/publication', publication)
app.route('/share', share)
app.route('/spotify', spotify)
app.route('/upload', upload)
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

export type AppType = typeof app

export default app
