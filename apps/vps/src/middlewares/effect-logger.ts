import { Context, Effect, Layer } from 'effect'
import type { MiddlewareHandler } from 'hono'
import { env } from '@/env'

export interface LoggerService {
  readonly log: (
    message: string,
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  ) => Effect.Effect<void>
  readonly logRequest: (
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ) => Effect.Effect<void>
}

export const LoggerService = Context.GenericTag<LoggerService>('LoggerService')

export const LoggerServiceLive = Layer.effect(
  LoggerService,
  Effect.gen(function* () {
    return {
      log: (message: string, level = 'info') =>
        Effect.log(`[${level.toUpperCase()}] ${message}`),

      logRequest: (
        method: string,
        path: string,
        statusCode: number,
        duration: number
      ) => Effect.log(`[INFO] ${method} ${path} ${statusCode} - ${duration}ms`)
    }
  })
)

export function effectLogger(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now()

    try {
      await next()
      const duration = Date.now() - start

      // Log with Effect logger
      const logEffect = Effect.log(
        `[INFO] ${c.req.method} ${c.req.path} ${c.res.status} - ${duration}ms`
      )

      if (env.NODE_ENV === 'production') {
        await Effect.runPromise(logEffect)
      } else {
        console.log(
          `🪿 ${c.req.method} ${c.req.path} ${c.res.status} - ${duration}ms`
        )
      }
    } catch (error) {
      const duration = Date.now() - start

      const logEffect = Effect.logError(
        `[ERROR] ${c.req.method} ${c.req.path} - ${duration}ms - ${error}`
      )

      if (env.NODE_ENV === 'production') {
        await Effect.runPromise(logEffect)
      } else {
        console.error(
          `❌ ${c.req.method} ${c.req.path} - ${duration}ms -`,
          error
        )
      }

      throw error
    }
  }
}
