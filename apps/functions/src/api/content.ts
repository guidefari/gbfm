import { Hono } from "hono";
import { DynamoWrapper } from "@gbfm/core/util/dynamo.wrapper";
import { Resource } from "sst";
import { createID } from "@gbfm/core/util/id";

export namespace ContentApi {
	export const route = new Hono()
		.get("/", async (c) => {
			const type = c.req.query("type");

			if (!type) {
				return c.json({ error: "type is required" }, 400);
			}

			const content = await DynamoWrapper.listByPrefix(
				Resource.ContentTable.name,
				type,
			);

			return c.json({ content }, 200);
		})
		.get("/:contentId", async (c) => {
			const contentId = c.req.param("contentId");

			if (!contentId) {
				return c.json({ error: "contentId is required" }, 400);
			}

			const content = await DynamoWrapper.readById(
				Resource.ContentTable.name,
				contentId,
			);

			if (!content) {
				return c.json({ error: "content not found" }, 404);
			}

			return c.json(content, 200);
		})
		.post("/seed", async (c) => {
			const content = await c.req.json();
			await DynamoWrapper.seed(Resource.ContentTable.name, content);
			return c.json({ message: "content seeded" }, 200);
		})
		.post("/", async (c) => {
			const content = await c.req.json();

			if (!content.type) {
				return c.json({ error: "content must include type and id" }, 400);
			}

			await DynamoWrapper.create(Resource.ContentTable.name, {
				contentId: createID(content.type),
				updatedAt: Date.now(),
				createdAt: Date.now(),
				...content,
			});

			return c.json({ message: "content created", content }, 201);
		})
		.put("/:id", async (c) => {
			const id = c.req.param("id");
			const updates = await c.req.json();

			if (!id) {
				return c.json({ error: "contentId is required" }, 400);
			}

			// Check if content exists
			const existingContent = await DynamoWrapper.readById(
				Resource.ContentTable.name,
				id
			);

			if (!existingContent) {
				return c.json({ error: "content not found" }, 404);
			}

			// Prevent modification of key fields
			const { contentId, createdAt, type, ...allowedUpdates } = updates;

            const updatedContent = {
                ...existingContent,
                ...allowedUpdates,
                updatedAt: Date.now(),
            };

			await DynamoWrapper.update(
				Resource.ContentTable.name,
				id,
				updatedContent
			);

			return c.json({ 
				message: "content updated",
				content: updatedContent 
			}, 200);
		});
}
