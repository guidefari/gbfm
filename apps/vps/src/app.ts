import { sql } from "drizzle-orm";
import { serveStatic } from "hono/bun";
import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import auth from "@/routes/auth/auth.index";
import content from "@/routes/content/content.index";
import publication from "@/routes/publication/publication.index";
import upload from "@/routes/upload/upload.index";
import rss from "@/routes/rss/rss.index";
import { db } from "./db";

const app = createApp();

configureOpenAPI(app);

const routes = [
  { path: "/auth", handler: auth },
  { path: "/content", handler: content },
  { path: "/publication", handler: publication },
  { path: "/upload", handler: upload },
  { path: "", handler: rss }, // RSS at root level
] as const;

routes.forEach((route) => {
  app.route(route.path, route.handler);
});

// Health check endpoint
app.get("/health", async (c) => {
  try {
    await db.execute(sql.raw("SELECT 1"));
    return c.json({ dbConnected: true });
  } catch {
    return c.json({ dbConnected: false }, 500);
  }
});

export type AppType = typeof routes[number];

export default app;