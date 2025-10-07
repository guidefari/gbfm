import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi'
import type { Schema } from 'hono'
import type { PinoLogger } from 'hono-pino'
import type { SelectAuthor } from '@/db/author.schema'

export interface AppBindings {
  Variables: {
    logger: PinoLogger
    user: Omit<SelectAuthor, 'password'>
  }
}

export type AppOpenAPI<S extends Schema = Schema> = OpenAPIHono<AppBindings, S>

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>
