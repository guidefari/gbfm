import { authorsTable } from "@/db/author.schema";
import Bun from "bun";
import { eq } from "drizzle-orm";
import { createRouter } from "@/lib/create-app";
import type { Handler } from "hono";
import type { AppBindings } from "@/lib/types";
import { Resource } from "sst";
import { db } from "@/db";
import { authenticate } from "@/middlewares/auth.middleware";
import {
  insertAuthorSchema as createAuthorSchema,
  updateProfileSchema,
} from "@/db/author.schema";
import { z } from "zod";

type CreateAuthorRequest = z.infer<typeof createAuthorSchema>;
type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

const app = createRouter();

app.post("/", (async (c) => {
	const data: CreateAuthorRequest = c.req.valid("json");

	const password = await Bun.password.hash(data.password);

	try {
		const [newAuthor] = await db
			.insert(authorsTable)
			.values({ ...data, password })
			.returning();

		const { password: _, ...authorWithoutPassword } = newAuthor;
		return c.json(authorWithoutPassword, 201);
	} catch (error) {
		if (error instanceof Error && error.message.includes("unique constraint")) {
			return c.json({ error: error.message }, 409);
		}

		return c.json({ error: "Failed to create author" }, 500);
	}
});

app.get("/", (async (c) => {
	const authors = await db.select().from(authorsTable);
	// Remove passwords from response
	const authorsWithoutPasswords = authors.map(({ password, ...author }) => author);
	return c.json(authorsWithoutPasswords);
});

app.patch("/updateProfile", authenticate, (async (c) => {
	let updateData: Partial<UpdateProfileRequest> = {};
	let username: string | undefined;

	try {
		const contentType = c.req.header("content-type") || "";
		if (contentType.includes("multipart/form-data")) {
			const formData = await c.req.formData();
			for (const [key, value] of formData.entries()) {
				if (
					key === "avatar" &&
					value &&
					typeof value === "object" &&
					"arrayBuffer" in value
				) {
					const file = value as File;
					const { uploadToS3 } = await import("@/bucket");
					const fileBuffer = Buffer.from(await file.arrayBuffer());
					const fileName = `avatar_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
					// Get bucket name from environment variables
					const bucketName = Resource.User_Content.name;
					const contentType = file.type || "application/octet-stream";
					await uploadToS3({
						key: fileName,
						body: fileBuffer,
						contentType,
						bucketName,
					});

					// Construct URL using the bucket router URL from environment variables
					updateData.avatarUrl = `${Resource.Router.url}/user-content/${fileName}`;
				} else if (typeof value === "string") {
					if (key === "password") {
						updateData.password = value; // Will be hashed below
					} else if (key === "name" || key === "username" || key === "email") {
						updateData[key] = value;
					}
					if (key === "username") username = value;
				}
			}
		} else {
			const requestBody = await c.req.json();
			updateData = { ...requestBody };
			username = requestBody.username;
		}

		// Hash password if provided
		if (updateData.password) {
			updateData.password = await Bun.password.hash(updateData.password);
		}
	} catch (err) {
		console.log("err:", err);
		return c.json({ error: "Invalid input" }, 400);
	}

	if (!username) {
		return c.json({ error: "Username is required" }, 400);
	}

	try {
		const [updated] = await db
			.update(authorsTable)
			.set(updateData)
			.where(eq(authorsTable.username, username))
			.returning();
		if (!updated) return c.json({ error: "Author not found" }, 404);
		const { password, ...authorWithoutPassword } = updated;
		return c.json(authorWithoutPassword, 200);
	} catch (error) {
		return c.json({ error: "Failed to update author" }, 500);
	}
}) as Handler<AppBindings>);

export default app;
