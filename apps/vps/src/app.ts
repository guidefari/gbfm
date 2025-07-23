import { sql } from "drizzle-orm";
import configureOpenAPI from "@/lib/configure-open-api";
import createApp from "@/lib/create-app";
import auth from "@/routes/auth/auth.index";
import author from "@/routes/author/author.index";
import content from "@/routes/content/content.index";
import mix from "@/routes/mix/mix.index.tsx";
import publication from "@/routes/publication/publication.index";
import { db } from "./db";

const app = createApp();

configureOpenAPI(app);

const routes = [
  { path: "/auth", handler: auth },
  { path: "/author", handler: author },
  { path: "/content", handler: content },
  { path: "/mix", handler: mix },
  { path: "/publication", handler: publication },
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