import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { MicroPost } from "@gbfm/core/microPost/index";
import { User } from "@gbfm/core/user/index.ts";

export namespace MicroPostApi {
	export const route = new OpenAPIHono()
		.openapi(
			createRoute({
				method: "post",
				path: "/",
				request: {
					body: {
						content: {
							"application/json": {
								schema: MicroPost.MicroPostSchema.pick({ content: true }),
							},
						},
					},
				},
				responses: {
					201: {
						description: "MicroPost created successfully",
					},
				},
			}),
			async (c) => {
				const payload = c.req.valid("json");
				const token = c.req.header("Authorization")?.split(" ")[1];
				if (!token) {
					return c.json({ error: "No token provided" }, 401);
				}
				const user = await User.fromToken(token);
				if (!user || !user.id) {
					return c.json({ error: "Invalid token" }, 401);
				}
				const microPost = await MicroPost.create(payload.content, user.id);
				return c.json(microPost, 201);
			},
		)
		.openapi(
			createRoute({
				method: "get",
				path: "/",
				responses: {
					200: {
						description: "List of MicroPosts",
					},
				},
			}),
			async (c) => {
				const microPosts = await MicroPost.listAll();
				return c.json(microPosts, 200);
			},
		)
		.openapi(
			createRoute({
				method: "post",
				path: "/seed",
				request: {
					body: {
						content: {
							"application/json": {
								schema: z.array(MicroPost.MicroPostSchema),
							},
						},
					},
				},
				responses: {
					200: {
						description: "MicroPosts seeded successfully",
					},
				},
			}),
			async (c) => {
				const microPosts = await MicroPost.seed(c.req.valid("json"));
				return c.json(microPosts, 200);
			},
		);
}
