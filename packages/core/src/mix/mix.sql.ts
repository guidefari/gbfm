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
import { moodTable } from "../mood/mood.sql";

export const mixesTable = pgTable("mixes", {
	id: text().primaryKey(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	date: date().notNull(),
	mp3Url: varchar({ length: 255 }).notNull(),
	thumbnailUrl: varchar({ length: 255 }),
	youtubeId: varchar({ length: 50 }),
	authorId: text().references(() => userTable.id),
	genres: text()
		.array()
		.references(() => moodTable.id),
	createdAt: timestamp().defaultNow(),
	updatedAt: timestamp().defaultNow(),
});

export type Mix = typeof mixesTable.$inferSelect;
export type NewMix = typeof mixesTable.$inferInsert;

export const mixesRelations = relations(mixesTable, ({ one, many }) => ({
	author: one(userTable, {
		fields: [mixesTable.authorId],
		references: [userTable.id],
	}),
	genres: many(moodTable),
}));

// export const
