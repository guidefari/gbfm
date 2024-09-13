import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Result } from "./common";
import { MDXArchiveTypes, MDXArchive } from "@gbfm/core/mdx/index";

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
									archetype: MDXArchiveTypes.archetype,
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
				const { archetype } = await c.req.json();
				const result = await MDXArchive.list(archetype);

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
				const { filename } = await c.req.json();

				const result = await MDXArchive.readOne(filename);

				return c.json({ result }, 200);
			},
		);
}
