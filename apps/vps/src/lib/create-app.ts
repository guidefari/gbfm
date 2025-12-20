import { OpenAPIHono } from '@hono/zod-openapi'
import type { Schema } from 'hono'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares'

import { pinoLogger } from '@/middlewares/pino-logger'
import type { AppBindings, AppOpenAPI } from './types'

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

  app.use(
    '*',
    cors({
      origin: [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3003',
        'https://www.goosebumps.fm',
        'https://goosebumps.fm'
      ],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Refresh-Token'],
      exposeHeaders: ['Set-Cookie'],
      credentials: true
    })
  )

  app.use(requestId()).use(serveEmojiFavicon('🪿')).use(pinoLogger())

  app.notFound(notFound)
  app.onError(onError)
  return app
}

export function createTestApp<S extends Schema>(router: AppOpenAPI<S>) {
  return createApp().route('/', router)
}
