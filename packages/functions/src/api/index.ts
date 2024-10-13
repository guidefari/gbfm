import { handle, streamHandle } from "hono/aws-lambda";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { SpotifyApi } from "./spotify";
import { MDXArchiveApi } from "./mdx-archive";
// import { AuthMiddleware } from "./auth.middleware";
import { swaggerUI } from "@hono/swagger-ui";

const app = new OpenAPIHono();

app.openapi(
	createRoute({
		method: "get",
		path: "/",
		responses: {
			200: {
				description: "Health check",
			},
		},
	}),
	(c) => c.json({ message: "sup, m8?" }, 200),
);

const routes = app
	// TODO: auth on a per route basis. and none of these need auth
	// .use("*", AuthMiddleware)
	.route("/spotify", SpotifyApi.route)
	.route("/mdx-archive", MDXArchiveApi.route);

app.doc("/doc", () => ({
	openapi: "3.0.0",
	info: {
		title: "Goosebumps API",
		version: "0.0.1",
	},
}));

app.get("/swag", swaggerUI({ url: "/doc" }));

export type Routes = typeof routes;
export const handler = process.env.SST_LIVE ? handle(app) : streamHandle(app);
