import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { User } from "@gbfm/core/user/index.ts";
import { AuthClient_API, s3 } from ".";
import { subjects } from "../subjects";
import { Resource } from "sst";
import { PutObjectCommand } from "@aws-sdk/client-s3";

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

				const user = await User.fromID(session.subject.properties.id);
				if (!user) {
					return c.json({ error: "User not found" }, 404);
				}

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

				// const user = await User.fromUsername(payload.username);
				const user = await User.fromID(id); // Fetch user first


				if (!user) {
					return c.json({ error: "User not found" }, 404);
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
		)
		// update avatar
		.openapi(
			createRoute({
				method: "put",
				path: "/:id/avatar",
				request: {
					body: {
						content: {
							"multipart/form-data": {
								schema: z.object({
									avatar: z.instanceof(File),
								}),
							},
						},
					},
				},
				responses: {
					200: {
						description: "Avatar updated successfully",
					},
				},
			}),
			async (c) => {
				const { id } = c.req.param();
				const payload = c.req.valid("form");
				const user = await User.fromID(id);
				if (!user) {
					return c.json({ error: "User not found" }, 404);
				}

				const fileBuffer = await payload.avatar.arrayBuffer();
				const fileName = `avatar_${id}_${payload.avatar.name.replace(/\s+/g, '_')}`;
				
				try {
					const result = await s3.send(
						new PutObjectCommand({
							Bucket: Resource.User_Content.name,
							Key: fileName,
							Body: Buffer.from(fileBuffer),
							ContentType: payload.avatar.type,
						})
					);

					// Generate S3 URL
					// const avatarUrl = `https://${Resource.Parameter.value.CONTENT_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
					const avatarUrl = `${Resource.FileRouter.url}/user-content/${fileName}`;
					console.log('avatarUrl:', avatarUrl)

					// Update user with avatar URL
					const updatedUser = await User.update({
						id,
						avatarUrl,
						...user,
					});

					return c.json(updatedUser, 200);
				} catch (error) {
					console.error('Error uploading avatar:', error);
					return c.json({ error: "Failed to upload avatar" }, 500);
				}
			},
		);
}
