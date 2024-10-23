import { sql } from "drizzle-orm";
import {
	pgTable,
	serial,
	varchar,
	text,
	date,
	timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "../user/user.sql";

export const microPostsTable = pgTable("micro_posts", {
	id: text("id").primaryKey(),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	date: date("date").notNull(),
	thumbnailUrl: varchar("thumbnail_url", { length: 255 }),
	author: text("author_id").references(() => userTable.id),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
	content: text("content"),
});

export type MicroPost = typeof microPostsTable.$inferSelect;
export type NewMicroPost = typeof microPostsTable.$inferInsert;
