import { Hono } from "hono";
import { DynamoWrapper } from "@gbfm/core/util/dynamo.wrapper";
import { Resource } from "sst";

export namespace ContentApi {
	export const route = new Hono()
		.get("/", async (c) => {
			const type = c.req.query("type");
			console.log('type:', type)

			const content = await DynamoWrapper.listAll(
				Resource.ContentTable.name,
			).then((items) => items.filter((item) => item.contentId.includes(type)));

			return c.json({ content }, 200);
		})
		.post("/seed", async (c) => {
			const content = await c.req.json();
			await DynamoWrapper.seed(Resource.ContentTable.name, content);
			console.log("content:", content);
			return c.json({ message: "content seeded" }, 200);
		});
}
