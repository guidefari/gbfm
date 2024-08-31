import { Hono } from "hono";
import { handle, streamHandle } from "hono/aws-lambda";
import { OpenAPIHono } from "@hono/zod-openapi";

const app = new OpenAPIHono();

app.get("/", (c) => {
	return c.text("Hello Hono!");
});

console.log("process.env.SST_LIVE:", process.env.SST_LIVE);
export const handler = process.env.SST_LIVE ? handle(app) : streamHandle(app);
