import { pgTable, text } from "drizzle-orm/pg-core";

export const moodTable = pgTable("moods", {
	id: text().primaryKey(),
	name: text(),
});

export type Mood = typeof moodTable.$inferSelect;
export type NewMood = typeof moodTable.$inferInsert;
