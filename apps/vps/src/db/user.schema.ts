import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
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

export const usersTable = pgTable('users', {
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

export const userPasswordResetTokensTable = pgTable(
  'user_password_reset_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => usersTable.id),
    token: varchar({ length: 255 }).notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  }
)

export const userSessionsTable = pgTable('user_sessions', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => usersTable.id),
  refreshToken: varchar({ length: 512 }).notNull().unique(),
  userAgent: varchar({ length: 512 }),
  ip: varchar({ length: 64 }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
})

export type SelectUser = InferSelectModel<typeof usersTable>
export type InsertUser = InferInsertModel<typeof usersTable>
export type SelectUserPasswordResetToken = InferSelectModel<
  typeof userPasswordResetTokensTable
>
export type InsertUserPasswordResetToken = InferInsertModel<
  typeof userPasswordResetTokensTable
>
export type SelectUserSession = InferSelectModel<typeof userSessionsTable>
export type InsertUserSession = InferInsertModel<typeof userSessionsTable>

// Zod schemas for API validation
export const selectUserSchemaV4 = z.object({
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

export const selectUserSchema = selectUserSchemaV4

export const insertUserSchema = z.object({
  name: z.string(),
  username: z.string().optional(),
  email: z.email(),
  password: z.string().optional(),
  verified: z.boolean().optional(),
  avatarUrl: z.string().optional()
})

export const selectUserPasswordResetTokenSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
  createdAt: z.date()
})

export const insertUserPasswordResetTokenSchema = z.object({
  userId: z.uuid(),
  token: z.string(),
  expiresAt: z.date()
})

export const selectUserSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  refreshToken: z.string(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const insertUserSessionSchema = z.object({
  userId: z.uuid(),
  refreshToken: z.string(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  expiresAt: z.date()
})

export const signupSchema = z.object({
  name: z.string(),
  email: z.email(),
  username: usernameSchema,
  password: z.string().min(8)
})

export const signinSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
})

export const forgotPasswordSchema = z.object({
  email: z.email()
})

export const resetPasswordSchema = z.object({
  email: z.email().optional(),
  userId: z.string().optional(),
  token: z.uuid(),
  password: z.string().min(8)
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string()
})

export const updateProfileSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().optional(),
  email: z.email().optional(),
  username: usernameSchema.optional(),
  password: z.string().min(8).optional(),
  avatarUrl: z.string().optional(),
  avatar: z.custom<File>().optional().openapi({
    type: 'string',
    format: 'binary',
    description: 'Avatar image file'
  })
})

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>

export const createUserSchema = z.object({
  name: z.string(),
  username: usernameSchema,
  email: z.email(),
  password: z.string().min(8)
})

export const userParamsSchema = z.object({
  id: z.uuid()
})

export const usersRelations = relations(usersTable, ({ many }) => ({
  postsToAuthors: many(postsToAuthors),
  audioToAuthors: many(audioToAuthors)
}))
