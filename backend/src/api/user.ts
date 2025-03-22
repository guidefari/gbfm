import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Result } from "./common";
import { User } from "@gbfm/core/user/index.ts";
import { AuthClient_API } from ".";
import { subjects } from "../subjects";
// import { User } from "@gbfm/core/user";

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
								schema: User.UserSchema.pick({ email: true }),
							},
						},
					},
				},
				responses: {
					201: {
						content: {
							"application/json": {
								schema: z.object({ id: z.string() }),
							},
						},
						description: "User created successfully",
					},
				},
			}),
			async (c) => {
				const payload = c.req.valid("json");
				let doesUserExist: User.PartialUser | null = null;

				try {
					doesUserExist = await User.fromEmail(payload.email);
				} catch (error) {
					return c.json({ error: "error retrieving user" }, 500);
				}

				if (doesUserExist) {
					return c.json({ error: "User already exists" }, 400);
				}
				const user = await User.create(payload.email);
				return c.json({ id: user.id }, 201);
			},
		)
		// Read User
		.openapi(
			createRoute({
				method: "get",
				path: "/",
				responses: {
					200: {
						// content: {
						// 	"application/json": {
						// 		schema: User.UserSchema.partial(),
						// 	},
						// },
						description: "Returns user details",
					},
					401: {
						description: "Unauthorized",
					},
				},
			}),
			async (c) => {
				const token = c.req.header("Authorization")?.split(" ")[1];
				
				if (!token) {
					return c.json({ error: "No token provided" }, 401);
				}

				const session = await AuthClient_API.verify(subjects, token);
				
				if (session.err) {
					console.error({ "session.err": session.err });
					return c.json({ error: "No session" }, 401);
				}

				return c.json(session.subject.properties, 200);
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
								schema: User.UserSchema.partial(),
							},
						},
					},
				},
				responses: {
					200: {
						content: {
							"application/json": {
								schema: User.UserSchema.partial(),
							},
						},
						description: "User updated successfully",
					},
				},
			}),
			async (c) => {
				const { id } = c.req.param();
				const payload = c.req.valid("json");
				const user = await User.fromID(id); // Fetch user first
				if (!user) {
					return c.json({ success: false }, 404); // User not found
				}
				const updatedUser = await User.update({
					id,
					...payload,
				});
				return c.json(updatedUser, 200);
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
				// can't delete self
				// can't delete if role !=admin
				await User.deleteByID(id);
				return c.json(null, 204);
			},
		);
}
