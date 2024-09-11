import { handle, streamHandle } from "hono/aws-lambda";
import { OpenAPIHono } from "@hono/zod-openapi";
import { SpotifyApi } from "./spotify";
import { MDXArchiveApi } from "./mdx-archive";

const app = new OpenAPIHono();

app.get("/", (c) => {
	return c.text("This space has been left intentionally blank🤫");
});

const routes = app
	.route("/spotify", SpotifyApi.route)
	.route("/mdx-archive", MDXArchiveApi.route);

app.doc("/doc", () => ({
	openapi: "3.0.0",
	info: {
		title: "Goosebumps API",
		version: "0.0.1",
	},
}));

export type Routes = typeof routes;
export const handler = process.env.SST_LIVE ? handle(app) : streamHandle(app);
