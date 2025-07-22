import { Hono } from "hono";

import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { env } from "../env";
import auth from "./auth";
import author from "./author";
import content from "./content";
import mix from "./mix";
import { pinoLogger } from "./pino.middleware";
import publication from "./publication";

const db = drizzle(env.DATABASE_URL);
const app = new Hono();

app.use(
	"*",
	cors({
		origin: [
			"http://localhost:5173",
			"http://localhost:4173",
			"http://localhost:3003",
			"https://www.goosebumps.fm",
			"https://goosebumps.fm",
		],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.use(requestId());
app.use(serveEmojiFavicon("🪿"));
app.use(pinoLogger());

app.notFound(notFound);
app.onError(onError);

app.route("/auth", auth);
app.route("/author", author);
app.route("/content", content);
app.route("/mix", mix);
app.route("/publication", publication);

app.get("/health", async (c) => {
	try {
		await db.execute(sql.raw("SELECT 1"));
		return c.json({ dbConnected: true });
	} catch {
		return c.json({ dbConnected: false }, 500);
	}
});

// app.post("/reset-tables", async (c) => {
// 	try {
// 		const body = (await c.req.json()) as { tables?: string[] };
// 		const tablesToReset = body?.tables;

// 		async function resetTable(table: Table) {
// 			return await db.execute(
// 				sql.raw(
// 					`TRUNCATE TABLE ${getTableName(table)} RESTART IDENTITY CASCADE`,
// 				),
// 			);
// 		}

//     // todo: don't forget to add future tables. also, could probably do this declaratively tbh
//     // but that's for another day😝
// 		const allTables = [
// 			authorsTable,
// 			postsTable,
// 			publicationsTable,

// 		];

// 		if (tablesToReset?.length) {
//       const failedToReset = new Set<string>();
//       const successfullyReset = new Set<string>();

// 			for (const tableName of tablesToReset) {
// 				const table = allTables.find((t) => getTableName(t) === tableName);

// 				if (!table) {
// 					failedToReset.add(tableName);
//           continue;
// 				}
// 				await resetTable(table);
//         successfullyReset.add(tableName);
// 			}
// 			return c.json({
//         ok: Array.from(successfullyReset),
//         notOk: Array.from(failedToReset),
// 			}, 201);
// 		}

// 		for (const table of allTables) {
// 			await resetTable(table);
// 		}
// 		return c.json({ message: "Reset all tables successfully" });
// 	} catch (error) {
// 		console.error("Error resetting tables:", error);
// 		return c.json({ error: "Failed to reset tables", stack: error }, 500);
// 	}
// });

export const localVPSPort = 3003;

export default {
	port: localVPSPort,
	fetch: app.fetch,
	maxRequestBodySize: 1024 * 1024 * 1000, // 1GB
};
