import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Result } from "./common";
import { User } from "@gbfm/core/user/index.ts";
// import { User } from "@gbfm/core/user"; // Import the User namespace

export namespace UserApi {
	User.setUserRepository("dynamo");

	// Create User
	export const route = new OpenAPIHono()
		.openapi(
			createRoute({
				method: "post",
				path: "/create",
				request: {
					body: {
						content: {
							"application/json": {
								schema: z.object({
									email: z.string().email(),
								}),
							},
						},
					},
				},
				responses: {
					201: {
						content: {
							"application/json": {
								schema: Result(z.object({ id: z.string() })),
							},
						},
						description: "User created successfully",
					},
				},
			}),
			async (c) => {
				const { email } = await c.req.json(); // Only email is needed for creation
				const user = await User.create(email); // Use User namespace to create user
				return c.json({ id: user.id }, 201);
			},
		)
		// Read User
		.openapi(
			createRoute({
				method: "get",
				path: "/:id",
				responses: {
					200: {
						content: {
							"application/json": {
								schema: Result(
									z.object({
										id: z.string(),
										email: z.string(),
									}),
								),
							},
						},
						description: "Returns user details",
					},
				},
			}),
			async (c) => {
				const { id } = c.req.param();
				const user = await User.fromID(id); // Use User namespace to fetch user by ID
				return c.json(user, 200);
			},
		)
		// Update User
		.openapi(
			createRoute({
				method: "put",
				path: "/:id",
				request: {
					body: {
						content: {
							"application/json": {
								schema: z.object({
									email: z.string().email().optional(),
								}),
							},
						},
					},
				},
				responses: {
					200: {
						content: {
							"application/json": {
								schema: Result(z.object({ success: z.boolean() })),
							},
						},
						description: "User updated successfully",
					},
				},
			}),
			async (c) => {
				const { id } = c.req.param();
				const { email } = await c.req.json();
				const user = await User.fromID(id); // Fetch user first
				if (!user) {
					return c.json({ success: false }, 404); // User not found
				}
				const success = await User.create(email); // Update user email
				return c.json({ success: !!success }, 200);
			},
		)
		// Delete User
		.openapi(
			createRoute({
				method: "delete",
				path: "/:id",
				responses: {
					204: {
						description: "User deleted successfully",
					},
				},
			}),
			async (c) => {
				const { id } = c.req.param();
				// Implement delete logic in the User namespace
				// Assuming a delete method exists in the User repository
				await User.delete(id); // Implement this function in the User namespace
				return c.json(null, 204);
			},
		);
}
