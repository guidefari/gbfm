import { S3Client } from "@aws-sdk/client-s3";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { handle, streamHandle } from "hono/aws-lambda";
import { BlueskyApi } from "./bsky";
import { ContentApi } from "./content";
import { MDXArchiveApi } from "./mdx-archive";
import { MicroPostApi } from "./microPost";
import { RssApi } from "./rss";
import { SpotifyApi } from "./spotify";
import { UserApi } from "./user";

export const s3 = new S3Client({});

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

app.route("/spotify", SpotifyApi.route);
app.route("/mdx-archive", MDXArchiveApi.route);
app.route("/micro-posts", MicroPostApi.route);
app.route("/bsky", BlueskyApi.route);
app.route("/content", ContentApi.route);
app.route("/rss", RssApi.route);
app.route("/users", UserApi.route);

app.doc("/doc", () => ({
	openapi: "3.0.0",
	info: {
		title: "Goosebumps API",
		version: "0.0.1",
	},
}));

app.get("/swag", swaggerUI({ url: "/doc" }));

export type Routes = typeof app;
export const handler = process.env.SST_LIVE ? handle(app) : streamHandle(app);
