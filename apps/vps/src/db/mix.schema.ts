import { relations } from "drizzle-orm";
import { index, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { authorsTable } from "./author.schema";
import { defaultContentFields } from "./util";

export const mixesTable = pgTable(
	"mixes",
	{
		...defaultContentFields,
		url: varchar({ length: 255 }).notNull(),
	},
	(table) => [index("mixes_slug_idx").on(table.slug)],
);

export const zMixSchema = createSelectSchema(mixesTable).extend({
	createdAt: z
		.string()
		.or(z.date())
		.transform((val) => new Date(val)),
	updatedAt: z
		.string()
		.or(z.date())
		.transform((val) => new Date(val)),
});

export const InsertMixSchema = createInsertSchema(mixesTable).omit({
	id: true,
	createdAt: true,
	updatedAt: true,
});

export type InsertMix = z.infer<typeof InsertMixSchema>;
export type MixSchema = z.infer<typeof zMixSchema>;

export const mixesToAuthors = pgTable(
	"mixes_to_authors",
	{
		mixId: uuid()
			.notNull()
			.references(() => mixesTable.id),
		authorId: uuid()
			.notNull()
			.references(() => authorsTable.id),
	},
	(t) => [primaryKey({ columns: [t.mixId, t.authorId] })],
);

export const mixesRelations = relations(mixesTable, ({ many }) => ({
	mixesToAuthors: many(mixesToAuthors),
}));

export const mixesToAuthorsRelations = relations(mixesToAuthors, ({ one }) => ({
	mix: one(mixesTable, {
		fields: [mixesToAuthors.mixId],
		references: [mixesTable.id],
	}),
	author: one(authorsTable, {
		fields: [mixesToAuthors.authorId],
		references: [authorsTable.id],
	}),
}));
