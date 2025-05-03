import { pgTable, varchar, index, primaryKey, uuid } from "drizzle-orm/pg-core";
import { defaultContentFields } from "./util";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { authorsTable } from "./author.schema";
import { relations } from "drizzle-orm";


export const mixesTable = pgTable("mixes", {
    ...defaultContentFields,
    url: varchar({ length: 255 }).notNull(),
  }, (table) => ([
    index('mixes_slug_idx').on(table.slug),
  ]));

  export const zMixSchema = createSelectSchema(mixesTable).extend({
    createdAt: z.string().or(z.date()).transform((val) => new Date(val)),
    updatedAt: z.string().or(z.date()).transform((val) => new Date(val)),
  });

  export const mixesToAuthors = pgTable('mixes_to_authors', {
    mixId: uuid()
      .notNull()
      .references(() => mixesTable.id),
    authorId: uuid()
      .notNull()
      .references(() => authorsTable.id),
  }, (t) => [
    primaryKey({ columns: [t.mixId, t.authorId] }),
  ]);

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