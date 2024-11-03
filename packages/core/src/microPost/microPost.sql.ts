import { relations, sql } from "drizzle-orm";
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
	id: text().primaryKey(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	date: date().notNull(),
	thumbnailUrl: varchar({ length: 255 }),
	authorId: text().references(() => userTable.id),
	createdAt: timestamp().defaultNow(),
	updatedAt: timestamp().defaultNow(),
	content: text(),
});

export type MicroPost = typeof microPostsTable.$inferSelect;
export type NewMicroPost = typeof microPostsTable.$inferInsert;

export const microPostsRelations = relations(microPostsTable, ({ one }) => ({
	author: one(userTable, {
		fields: [microPostsTable.authorId],
		references: [userTable.id],
	}),
}));
