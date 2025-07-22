import { relations, sql } from "drizzle-orm";
import {
	pgTable,
	serial,
	varchar,
	text,
	date,
	timestamp,
} from "drizzle-orm/pg-core";
import { userTable } from "../drizzle/schemas/user.sql";
import { moodTable } from "../drizzle/schemas/mood.sql";

export const postsTable = pgTable("posts", {
	id: text().primaryKey(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	date: date().notNull(),
	thumbnailUrl: varchar({ length: 255 }),
	authorId: text().references(() => userTable.id),
	genres: text()
		.array()
		.references(() => moodTable.id),
	createdAt: timestamp().defaultNow(),
	updatedAt: timestamp().defaultNow(),
	content: text(),
});

export type Post = typeof postsTable.$inferSelect;
export type NewPost = typeof postsTable.$inferInsert;

export const postsRelations = relations(postsTable, ({ one, many }) => ({
	author: one(userTable, {
		fields: [postsTable.authorId],
		references: [userTable.id],
	}),
	genres: many(moodTable),
}));
