import { pgTable, text } from "drizzle-orm/pg-core";

export const moodTable = pgTable("moods", {
	id: text("id").primaryKey(),
	name: text("name"),
});

export type Mood = typeof moodTable.$inferSelect;
export type NewMood = typeof moodTable.$inferInsert;
