import { relations, sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { authorsTable } from './author.schema';
import { postsTable } from './post.schema';

export const publicationsTable = pgTable('publications', {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  description: text(),
  slug: text().notNull().unique(),
});

export const publicationAuthors = pgTable('publication_authors', {
  publicationId: uuid()
    .notNull()
    .references(() => publicationsTable.id, { onDelete: 'cascade' }),
  authorId: uuid()
    .notNull()
    .references(() => authorsTable.id, { onDelete: 'cascade' }),
});

export const publicationPosts = pgTable('publication_posts', {
  publicationId: uuid()
    .notNull()
    .references(() => publicationsTable.id, { onDelete: 'cascade' }),
  postId: uuid()
    .notNull()
    .references(() => postsTable.id, { onDelete: 'cascade' }),
});

export const publicationsRelations = relations(publicationsTable, ({ many }) => ({
  authors: many(publicationAuthors),
  posts: many(postsTable),
}));

export const insertPublicationSchema = createInsertSchema(publicationsTable, {
  name: z.string().min(1),
  description: z.string().optional(),
});

export const selectPublicationSchema = createSelectSchema(publicationsTable);

export type Publication = z.infer<typeof selectPublicationSchema>;
export type NewPublication = z.infer<typeof insertPublicationSchema>;
