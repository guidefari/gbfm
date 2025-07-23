import { relations } from "drizzle-orm";
import {
	boolean,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { mixesToAuthors } from "./mix.schema";
import { postsToAuthors } from "./post.schema";
import { postsTable } from "./post.schema";
import { publicationPosts } from "./publication.schema";
import { publicationsTable } from "./publication.schema";

export const authorsTable = pgTable("authors", {
	id: uuid().primaryKey().defaultRandom(),
	name: varchar({ length: 255 }).notNull(),
	username: varchar({ length: 255 }).unique(),
	email: varchar({ length: 255 }).notNull().unique(),
	password: varchar({ length: 255 }),
	verified: boolean().notNull().default(false),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	avatarUrl: varchar({ length: 255 }),
});

export const authorPasswordResetTokensTable = pgTable(
	"author_password_reset_tokens",
	{
		id: uuid().primaryKey().defaultRandom(),
		authorId: uuid()
			.notNull()
			.references(() => authorsTable.id),
		token: varchar({ length: 255 }).notNull().unique(),
		expiresAt: timestamp({ withTimezone: true }).notNull(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
);

export const authorSessionsTable = pgTable("author_sessions", {
	id: uuid().primaryKey().defaultRandom(),
	authorId: uuid()
		.notNull()
		.references(() => authorsTable.id),
	refreshToken: varchar({ length: 512 }).notNull().unique(),
	userAgent: varchar({ length: 512 }),
	ip: varchar({ length: 64 }),
	expiresAt: timestamp({ withTimezone: true }).notNull(),
	createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const selectAuthorPasswordResetTokenSchema = createSelectSchema(
	authorPasswordResetTokensTable,
);
export const insertAuthorPasswordResetTokenSchema = createInsertSchema(
	authorPasswordResetTokensTable,
);

export const selectAuthorSessionSchema =
	createSelectSchema(authorSessionsTable);
export const insertAuthorSessionSchema =
	createInsertSchema(authorSessionsTable);

export const selectAuthorSchema = createSelectSchema(authorsTable);
export const insertAuthorSchema = createInsertSchema(authorsTable);

export const signupSchema = insertAuthorSchema.pick({
  name: true,
  username: true,
  email: true,
  password: true,
}).extend({
  password: z.string().min(8),
});

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  email: z.string().email().optional(),
  authorId: z.string().optional(),
  token: z.string().uuid(),
  password: z.string().min(8),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const updateProfileSchema = insertAuthorSchema.pick({
  name: true,
  username: true,
  email: true,
  password: true,
  avatarUrl: true,
}).partial().extend({
  password: z.string().min(8).optional(),
});

// User management schemas
export const createUserSchema = insertAuthorSchema.pick({
  name: true,
  username: true,
  email: true,
  password: true,
}).extend({
  password: z.string().min(8),
});

export const userParamsSchema = z.object({
  id: z.string().uuid(),
});

export const authorsRelations = relations(authorsTable, ({ many }) => ({
	postsToAuthors: many(postsToAuthors),
	mixesToAuthors: many(mixesToAuthors),
}));

export const publicationPostsRelations = relations(
	publicationPosts,
	({ one }) => ({
		publication: one(publicationsTable, {
			fields: [publicationPosts.publicationId],
			references: [publicationsTable.id],
		}),
		post: one(postsTable, {
			fields: [publicationPosts.postId],
			references: [postsTable.id],
		}),
	}),
);
