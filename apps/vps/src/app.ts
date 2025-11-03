import { sql } from 'drizzle-orm'
import configureOpenAPI from '@/lib/configure-open-api'
import createApp from '@/lib/create-app'
import auth from '@/routes/auth/auth.index'
import content from '@/routes/content/content.index'
import email from '@/routes/email/email.index'
import publication from '@/routes/publication/publication.index'
import rss from '@/routes/rss/rss.index'
import spotify from '@/routes/spotify/spotify.index'
import upload from '@/routes/upload/upload.index'
import { db } from './db'

const app = createApp()

configureOpenAPI(app)

const routes = [
  { path: '/auth', handler: auth },
  { path: '/content', handler: content },
  { path: '/email', handler: email },
  { path: '/publication', handler: publication },
  { path: '/spotify', handler: spotify },
  { path: '/upload', handler: upload },
  { path: '', handler: rss }
] as const

routes.forEach((route) => {
  try {
    console.log(`Registering route: ${route.path}`)
    app.route(route.path, route.handler)
    console.log(`✓ Successfully registered: ${route.path}`)
  } catch (error) {
    console.error(`✗ Failed to register route: ${route.path}`)
    console.error(error)
    throw error
  }
})

// Health check endpoint
app.get('/health', async (c) => {
  try {
    await db.execute(sql.raw('SELECT 1'))
    return c.json({ dbConnected: true })
  } catch {
    return c.json({ dbConnected: false }, 500)
  }
})

export type AppType = (typeof routes)[number]

export default app
