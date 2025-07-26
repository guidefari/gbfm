import type { OpenAPIHono, RouteConfig, RouteHandler, z } from "@hono/zod-openapi";
import type { Schema } from "hono";
import type { PinoLogger } from "hono-pino";
import type { selectAuthorSchema } from "@/db/author.schema";

export interface AppBindings {
  Variables: {
    logger: PinoLogger;
    user: Omit<z.infer<typeof selectAuthorSchema>, "password">;
  };
};

export type AppOpenAPI<S extends Schema = {}> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;