import { authorsTable, createAuthorSchema } from "@/db/author.schema";
import { zValidator } from "@hono/zod-validator";
import Bun from "bun";
import { eq } from "drizzle-orm";
import { createRouter } from "@/lib/create-app";
import type { Context } from "hono";
import { Resource } from "sst";
import { db } from "@/db";
import { authenticate } from "@/middlewares/auth.middleware";

const app = createRouter();

// export const createAuthorSchema = zAuthorSchema.omit({ id: true, createdAt: true, updatedAt: true, verified: true });

app.post("/", zValidator("json", createAuthorSchema), async (c: Context) => {
	const data = await c.req.json();

	const password = await Bun.password.hash(data.password);

	try {
		const [newAuthor] = await db
			.insert(authorsTable)
			.values({ ...data, password })
			.returning();

		return c.json(newAuthor, 201);
	} catch (error) {
		if (error instanceof Error && error.message.includes("unique constraint")) {
			return c.json({ error: error.message }, 409);
		}

		return c.json({ error: "Failed to create author" }, 500);
	}
});

app.get("/", async (c: Context) => {
	const authors = await db.select().from(authorsTable);
	return c.json(authors);
});

app.patch("/updateProfile", authenticate, async (c: Context) => {
	let updateData: Record<string, unknown> = {};
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
						updateData.password = await Bun.password.hash(value);
					} else {
						updateData[key] = value;
					}
					if (key === "username") username = value;
				}
			}
		} else {
			const requestBody = await c.req.json();
			if (requestBody.password) {
				requestBody.password = await Bun.password.hash(requestBody.password);
			}
			updateData = { ...requestBody };
			username = requestBody.username;
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
});

export default app;
