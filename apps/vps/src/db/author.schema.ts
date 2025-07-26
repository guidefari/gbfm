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
import { audioToAuthors } from "./audio.schema";
import { postsToAuthors } from "./post.schema";
import { postsTable } from "./post.schema";
import { publicationPosts } from "./publication.schema";
import { publicationsTable } from "./publication.schema";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be less than 30 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")
  .regex(/^[a-zA-Z]/, "Username must start with a letter")
  .regex(/[a-zA-Z0-9]$/, "Username must end with a letter or number");

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
  email: true,
  password: true,
}).extend({
  username: usernameSchema,
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
  id: true,
  name: true,
  email: true,
  password: true,
  avatarUrl: true,
}).partial().extend({
  username: usernameSchema.optional(),
  password: z.string().min(8).optional(),
  avatar: z.instanceof(File).optional(),
});

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;

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
	audioToAuthors: many(audioToAuthors),
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
