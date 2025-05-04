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
  publicationAuthors: many(publicationAuthors),
}));

export const publicationAuthorsRelations = relations(publicationAuthors, ({ one }) => ({
  publication: one(publicationsTable, {
    fields: [publicationAuthors.publicationId],
    references: [publicationsTable.id],
  }),
  author: one(authorsTable, {
    fields: [publicationAuthors.authorId],
    references: [authorsTable.id],
  }),
}));

export const publicationPostsRelations = relations(publicationPosts, ({ one }) => ({
  publication: one(publicationsTable, {
    fields: [publicationPosts.publicationId],
    references: [publicationsTable.id],
  }),
  post: one(postsTable, {
    fields: [publicationPosts.postId],
    references: [postsTable.id],
  }),
}));

export const insertPublicationSchema = createInsertSchema(publicationsTable, {
  name: z.string().min(1),
  description: z.string().optional(),
});

export const selectPublicationSchema = createSelectSchema(publicationsTable);

export type Publication = z.infer<typeof selectPublicationSchema>;
export type NewPublication = z.infer<typeof insertPublicationSchema>;
