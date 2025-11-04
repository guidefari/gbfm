import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi'
import type { Schema } from 'hono'
import type { PinoLogger } from 'hono-pino'
import type { SelectUser } from '@/db/user.schema'

export interface AppBindings {
  Variables: {
    logger: PinoLogger
    user: Omit<SelectUser, 'password'>
  }
}

export type AppOpenAPI<S extends Schema = Schema> = OpenAPIHono<AppBindings, S>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>
