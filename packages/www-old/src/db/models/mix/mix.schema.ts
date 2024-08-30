import { sql } from "drizzle-orm";
import {
	pgTable,
	serial,
	varchar,
	text,
	date,
	timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "../user/user.schema";
import { moodTable } from "../mood/mood.schema";

export const mixesTable = pgTable("mixes", {
	id: text("id").primaryKey(),
	title: varchar("title", { length: 255 }).notNull(),
	description: text("description"),
	date: date("date").notNull(),
	mp3Url: varchar("mp3_url", { length: 255 }).notNull(),
	thumbnailUrl: varchar("thumbnail_url", { length: 255 }),
	youtubeId: varchar("youtube_id", { length: 50 }),
	author: text("author_id").references(() => userTable.id),
	genres: text("genres")
		.array()
		.references(() => moodTable.id),
	url: varchar("url", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export type Mix = typeof mixesTable.$inferSelect;
export type NewMix = typeof mixesTable.$inferInsert;
