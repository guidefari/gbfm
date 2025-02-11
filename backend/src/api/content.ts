import { Hono } from "hono";
import { DynamoWrapper } from "@gbfm/core/util/dynamo.wrapper";
import { Resource } from "sst";

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
				contentId
			);

			if (!content) {
				return c.json({ error: "content not found" }, 404);
			}

			return c.json( content , 200);
		})
		.post("/seed", async (c) => {
			const content = await c.req.json();
			await DynamoWrapper.seed(Resource.ContentTable.name, content);
			return c.json({ message: "content seeded" }, 200);
		});
}
