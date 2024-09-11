import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Result } from "./common";
import { SpotifyHttp, SpotifyProxyTypes } from "@gbfm/core/spotify/index";
import { cors } from "hono/cors";
import { Resource } from "sst";
import { csrf } from "hono/csrf";
import {
	ListObjectsV2Command,
	S3Client,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import grayMatter from "gray-matter";

const s3 = new S3Client({});
export namespace MDXArchiveApi {
	export const route = new OpenAPIHono()
		.openapi(
			createRoute({
				method: "post",
				path: "/list",
				request: {
					body: {
						content: {
							"application/json": {
								schema: z.object({
									archetype: z.enum(["mixes", "labels", "micro", "words"]),
								}),
							},
						},
					},
				},
				responses: {
					200: {
						content: {
							"application/json": {
								schema: Result(z.array(z.string())),
							},
						},
						description: "Returns track details",
					},
				},
			}),
			async (c) => {
				const objects = await s3.send(
					new ListObjectsV2Command({
						Bucket: Resource.MDX_Archive.name,
					}),
				);

				if (!objects.Contents) {
					return c.json({ result: [] }, 200);
				}

				const result =
					objects.Contents.map((object) => object.Key).filter(
						(key): key is string => {
							if (!key) return false;

							const postType = key.split("/")[0];

							return postType === c.req.valid("json").archetype;
						},
					) || [];

				return c.json({ result }, 200);
			},
		)
		.openapi(
			createRoute({
				method: "post",
				path: "/read",
				request: {
					body: {
						content: {
							"application/json": {
								schema: z.object({
									filename: z.string(),
								}),
							},
						},
					},
				},
				responses: {
					200: {
						content: {
							"application/json": {
								schema: Result(z.object({})),
							},
						},
						description: "Returns an object of the post",
					},
				},
			}),
			async (c) => {
				const object = await s3.send(
					new GetObjectCommand({
						Bucket: Resource.MDX_Archive.name,
						Key: c.req.valid("json").filename,
					}),
				);

				if (!object.Body) {
					return c.json({ result: {} }, 200);
				}

				const result = await object.Body.transformToString();
				const gray = grayMatter(result);

				// if (!objects.Contents) {
				// 	return c.json({ result: [] }, 200);
				// }

				return c.json({ result: gray }, 200);
			},
		);
}
