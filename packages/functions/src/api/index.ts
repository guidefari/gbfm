import { handle, streamHandle } from "hono/aws-lambda";
import { OpenAPIHono } from "@hono/zod-openapi";
import { SpotifyApi } from "./spotify";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Resource } from "sst";
import { MDXArchiveApi } from "./mdx-archive";

const s3 = new S3Client({});

const app = new OpenAPIHono();

app.get("/", (c) => {
	return c.text("This space has been left intentionally blank🤫");
});

app.get("/list", async (c) => {
	const objects = await s3.send(
		new ListObjectsV2Command({
			Bucket: Resource.MDX_Archive.name,
		}),
	);

	return c.json(objects);
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
