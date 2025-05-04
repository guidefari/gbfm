import { Hono } from "hono";

import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../env";
import { sql } from "drizzle-orm";
import { getTableName } from "drizzle-orm";
import type { Table } from "drizzle-orm";
import content from "./content";
import author from "./author";
import mix from "./mix";
import { authorsTable } from "@/db/author.schema";
import { postsTable } from "@/db/post.schema";
import publication from "./publication";
import { publicationsTable, publicationAuthors, publicationPosts } from "@/db/publication.schema";
import auth from "./auth";
import { ZodError } from "zod";

const db = drizzle(env.DATABASE_URL);
const app = new Hono();

app.onError((err, c) => {
	if (err instanceof ZodError) {
		return c.json({ error: "Invalid request", details: err.errors }, 400);
	}
	throw err;
});

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

export default {
	port: 3003,
	fetch: app.fetch,
	maxRequestBodySize: 1024 * 1024 * 1000, // 1GB
};
