import { pgEnum, pgTable, varchar, index, primaryKey, uuid } from "drizzle-orm/pg-core";
import { defaultContentFields } from "./util";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { authorsTable } from "./author.schema";
import { relations } from "drizzle-orm";
import {  publicationsTable } from "./publication.schema";

export const postTypeEnum = pgEnum('post_type', ['post', 'micro', 'label']);

export const postsTable = pgTable("posts", {
  ...defaultContentFields,
  type: postTypeEnum(),
  publicationId: uuid().references(() => publicationsTable.id, { onDelete: 'set null' }),
}, (table) => ([
  index('posts_slug_idx').on(table.slug),
]));

export const zPostSchema = createSelectSchema(postsTable).extend({
    createdAt: z.string().or(z.date()).transform((val) => new Date(val)),
    updatedAt: z.string().or(z.date()).transform((val) => new Date(val)),
  });

  export const postsToAuthors = pgTable('posts_to_authors', {
    postId: uuid()
      .notNull()
      .references(() => postsTable.id),
    authorId: uuid()
      .notNull()
      .references(() => authorsTable.id),
  }, (t) => [
    primaryKey({ columns: [t.postId, t.authorId] }),
  ]);

  export const postsRelations = relations(postsTable, ({ many, one }) => ({
    postsToAuthors: many(postsToAuthors),
    publication: one(publicationsTable, {
      fields: [postsTable.publicationId],
      references: [publicationsTable.id],
    }),
  }));

  export const postsToAuthorsRelations = relations(postsToAuthors, ({ one }) => ({
    post: one(postsTable, {
      fields: [postsToAuthors.postId],
      references: [postsTable.id],
    }),
    author: one(authorsTable, {
      fields: [postsToAuthors.authorId],
      references: [authorsTable.id],
    }),
  }));