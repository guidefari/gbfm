import { moodTable } from "@/drizzle/schemas/mood.sql";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";

export const recordLabelTable = pgTable("record_label", {
	id: text().primaryKey(),
	name: varchar({ length: 255 }),
	thumbnailUrl: varchar({ length: 255 }),
	website: varchar({ length: 255 }),
	discogs: varchar({ length: 255 }),
	bandcamp: varchar({ length: 255 }),
	genres: text()
		.array()
		.references(() => moodTable.id),
});

export type RecordLabel = typeof recordLabelTable.$inferSelect;
export type NewRecordLabel = typeof recordLabelTable.$inferInsert;

export const recordLabelRelations = relations(recordLabelTable, ({ many }) => ({
	genres: many(moodTable),
}));
