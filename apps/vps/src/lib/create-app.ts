import { OpenAPIHono } from '@hono/zod-openapi'
import { Effect } from 'effect'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { notFound, onError, serveEmojiFavicon } from 'stoker/middlewares'
import { effectLogger } from '@/middlewares/effect-logger'
import { standardRateLimiter } from '@/middlewares/rate-limiter'
import { runAppFork } from '@/runtime'
import { config } from '@/services/config.service'
import { SentryService } from '@/services/sentry.service'
import type { AppBindings } from './types'

export const corsConfig = {
  origin: (origin: string) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:3003',
      'https://www.goosebumps.fm',
      'https://goosebumps.fm',
      config.urls.frontend
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

export const createAppEffect = Effect.sync(() => {
  const app = createRouter()

  app.use('*', cors(corsConfig))
  app
    .use(requestId())
    .use(serveEmojiFavicon('🪿'))
    .use(effectLogger())
    .use(standardRateLimiter())

  app.notFound(notFound)
  app.onError((err, c) => {
    runAppFork(
      Effect.flatMap(SentryService, (sentry) =>
        sentry.captureException(err, {
          path: c.req.path,
          method: c.req.method,
          requestId: c.get('requestId')
        })
      )
    )
    return onError(err, c)
  })

  return app
})
