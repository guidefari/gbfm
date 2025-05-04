import { pgTable, varchar, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { postsToAuthors } from "./post.schema";
import { mixesToAuthors } from "./mix.schema";
import { publicationPosts } from "./publication.schema";
import { publicationsTable } from "./publication.schema";
import { postsTable } from "./post.schema";

export const authorsTable = pgTable("authors", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }),
  verified: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const authorPasswordResetTokensTable = pgTable("author_password_reset_tokens", {
  id: uuid().primaryKey().defaultRandom(),
  authorId: uuid().notNull().references(() => authorsTable.id),
  token: varchar({ length: 255 }).notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const authorSessionsTable = pgTable("author_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  authorId: uuid().notNull().references(() => authorsTable.id),
  refreshToken: varchar({ length: 255 }).notNull().unique(),
  userAgent: varchar({ length: 512 }),
  ip: varchar({ length: 64 }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const selectAuthorPasswordResetTokenSchema = createSelectSchema(authorPasswordResetTokensTable);
export const insertAuthorPasswordResetTokenSchema = createInsertSchema(authorPasswordResetTokensTable);

export const selectAuthorSessionSchema = createSelectSchema(authorSessionsTable);
export const insertAuthorSessionSchema = createInsertSchema(authorSessionsTable);

export const zAuthorSchema = createSelectSchema(authorsTable);
export const createAuthorSchema = createInsertSchema(authorsTable);

export const authorsRelations = relations(authorsTable, ({ many }) => ({
    postsToAuthors: many(postsToAuthors),
    mixesToAuthors: many(mixesToAuthors),
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
