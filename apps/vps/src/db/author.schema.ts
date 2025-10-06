import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { z } from 'zod/v4'
import { audioToAuthors } from './audio.schema'
import { postsToAuthors } from './post.schema'

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and hyphens'
  )
  .regex(/^[a-zA-Z]/, 'Username must start with a letter')
  .regex(/[a-zA-Z0-9]$/, 'Username must end with a letter or number')

export const authorsTable = pgTable('authors', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  username: varchar({ length: 255 }).unique(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }),
  verified: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  avatarUrl: varchar({ length: 255 })
})

export const authorPasswordResetTokensTable = pgTable(
  'author_password_reset_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    authorId: uuid()
      .notNull()
      .references(() => authorsTable.id),
    token: varchar({ length: 255 }).notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  }
)

export const authorSessionsTable = pgTable('author_sessions', {
  id: uuid().primaryKey().defaultRandom(),
  authorId: uuid()
    .notNull()
    .references(() => authorsTable.id),
  refreshToken: varchar({ length: 512 }).notNull().unique(),
  userAgent: varchar({ length: 512 }),
  ip: varchar({ length: 64 }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
})

export type SelectAuthor = InferSelectModel<typeof authorsTable>
export type InsertAuthor = InferInsertModel<typeof authorsTable>
export type SelectAuthorPasswordResetToken = InferSelectModel<
  typeof authorPasswordResetTokensTable
>
export type InsertAuthorPasswordResetToken = InferInsertModel<
  typeof authorPasswordResetTokensTable
>
export type SelectAuthorSession = InferSelectModel<typeof authorSessionsTable>
export type InsertAuthorSession = InferInsertModel<typeof authorSessionsTable>

// Zod schemas for API validation
export const selectAuthorSchemaV4 = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  email: z.string(),
  password: z.string().nullable(),
  verified: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  avatarUrl: z.string().nullable()
})

export const selectAuthorSchema = selectAuthorSchemaV4

export const insertAuthorSchema = z.object({
  name: z.string(),
  username: z.string().optional(),
  email: z.string().email(),
  password: z.string().optional(),
  verified: z.boolean().optional(),
  avatarUrl: z.string().optional()
})

export const selectAuthorPasswordResetTokenSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
  createdAt: z.date()
})

export const insertAuthorPasswordResetTokenSchema = z.object({
  authorId: z.string().uuid(),
  token: z.string(),
  expiresAt: z.date()
})

export const selectAuthorSessionSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  refreshToken: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const insertAuthorSessionSchema = z.object({
  authorId: z.string().uuid(),
  refreshToken: z.string(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  expiresAt: z.date()
})

export const signupSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  username: usernameSchema,
  password: z.string().min(8)
})

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export const forgotPasswordSchema = z.object({
  email: z.string().email()
})

export const resetPasswordSchema = z.object({
  email: z.string().email().optional(),
  authorId: z.string().optional(),
  token: z.string().uuid(),
  password: z.string().min(8)
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string()
})

export const updateProfileSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  username: usernameSchema.optional(),
  password: z.string().min(8).optional(),
  avatarUrl: z.string().optional(),
  avatar: z.instanceof(File).optional()
})

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>

export const createUserSchema = z.object({
  name: z.string(),
  username: usernameSchema,
  email: z.string().email(),
  password: z.string().min(8)
})

export const userParamsSchema = z.object({
  id: z.uuid()
})

export const authorsRelations = relations(authorsTable, ({ many }) => ({
  postsToAuthors: many(postsToAuthors),
  audioToAuthors: many(audioToAuthors)
}))
