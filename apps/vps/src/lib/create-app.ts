import { OpenAPIHono } from '@hono/zod-openapi'
import { Effect } from 'effect'
import type { Schema } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares'

import { env } from '@/env'
import { effectLogger } from '@/middlewares/effect-logger'
import type { AppBindings, AppOpenAPI } from './types'

export const corsConfig = {
  origin: (origin: string) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:3003',
      'https://www.goosebumps.fm',
      'https://goosebumps.fm',
      env.FRONTEND_URL
    ]
    if (allowedOrigins.includes(origin)) {
      return origin
    }
    return 'https://goosebumps.fm'
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Refresh-Token'],
  exposeHeaders: ['Set-Cookie'],
  credentials: true
}

export function createRouter() {
  return new OpenAPIHono<AppBindings>({
    strict: false,
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            success: result.success,
            error: {
              issues: result.error.issues
            }
          },
          HttpStatusCodes.UNPROCESSABLE_ENTITY
        )
      }
    }
  })
}

export default function createApp() {
  const app = createRouter()

  app.use('*', cors(corsConfig))

  app.use(requestId()).use(serveEmojiFavicon('🪿')).use(effectLogger())

  app.notFound(notFound)
  app.onError(onError)
  return app
}

export const createAppEffect = Effect.sync(() => {
  const app = createRouter()

  app.use('*', cors(corsConfig))
  app.use(requestId()).use(serveEmojiFavicon('🪿')).use(effectLogger())

  app.notFound(notFound)
  app.onError(onError)

  return app
})

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route('/', router)
}
