import { z } from '@hono/zod-openapi'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { audioCreators } from './audio.schema'
import { emailDeliveryLogsTable, userEmailPreferencesTable } from './email.schema'
import { postCreators } from './post.schema'
import { showCreators, showSubscriptionsTable } from './show.schema'

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  username: text('username').unique(),
  displayUsername: text('display_username').unique(),
  role: text('role').default('user').notNull(),
  banned: boolean('banned').default(false).notNull(),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires')
})

export const SOCIAL_LINK_PLATFORMS = [
  'bandcamp',
  'substack',
  'soundcloud',
  'instagram',
  'twitter',
  'tiktok'
] as const

export type SocialLinkPlatform = (typeof SOCIAL_LINK_PLATFORMS)[number]

export const socialLinkPlatformSchema = z.enum(SOCIAL_LINK_PLATFORMS)

export const userSocialLinkSchema = z.object({
  platform: socialLinkPlatformSchema.openapi({
    description: 'Social link platform'
  }),
  url: z.string().url().openapi({ description: 'Social link URL' }),
  position: z
    .number()
    .int()
    .nonnegative()
    .openapi({ description: 'Order position for this social link' })
})

export type UserSocialLink = z.infer<typeof userSocialLinkSchema>

export const userSocialLinksSchema = z.array(userSocialLinkSchema)

export const userSocialLinks = pgTable(
  'user_social_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    url: text('url').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    index('user_social_links_user_id_idx').on(table.userId),
    uniqueIndex('user_social_links_user_position_uq').on(table.userId, table.position)
  ]
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    impersonatedBy: text('impersonated_by')
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [index('account_userId_idx').on(table.userId)]
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  socialLinks: many(userSocialLinks),
  postCreators: many(postCreators),
  audioCreators: many(audioCreators),
  emailDeliveryLogs: many(emailDeliveryLogsTable),
  userEmailPreferences: one(userEmailPreferencesTable),
  showCreators: many(showCreators),
  showSubscriptions: many(showSubscriptionsTable)
}))

export type SelectUser = InferSelectModel<typeof user>
export type InsertUser = InferInsertModel<typeof user>

export const selectUserSchema = z
  .object({
    id: z.string().openapi({ description: 'Unique identifier for the user' }),
    name: z.string().openapi({ description: 'Display name of the user' }),
    username: z.string().nullable().openapi({ description: 'Username of the user' }),
    email: z.string().openapi({ description: 'Email address of the user' }),
    emailVerified: z.boolean().openapi({ description: 'Whether the email is verified' }),
    image: z.string().nullable().openapi({ description: 'Profile image URL' }),
    bio: z.string().nullable().openapi({ description: 'User biography' }),
    createdAt: z.date().openapi({ description: 'Account creation timestamp' }),
    updatedAt: z.date().openapi({ description: 'Last account update timestamp' }),
    role: z.string().openapi({ description: 'User role', example: 'user' }),
    banned: z.boolean().openapi({ description: 'Whether the user is banned' }),
    banReason: z.string().nullable().openapi({ description: 'Reason for ban if applicable' }),
    banExpires: z.date().nullable().openapi({ description: 'Ban expiration date if applicable' })
  })
  .openapi('User')

export const insertUserSchema = z
  .object({
    name: z.string().openapi({
      description: 'Display name of the user',
      example: 'John Doe'
    }),
    username: z.string().optional().openapi({
      description: 'Username of the user',
      example: 'johndoe'
    }),
    email: z.string().email().openapi({
      description: 'Email address of the user',
      example: 'john@example.com'
    }),
    image: z.string().optional().openapi({ description: 'Profile image URL' }),
    bio: z.string().max(500).optional().openapi({ description: 'User biography' }),
    role: z.string().optional().openapi({ description: 'User role', default: 'user' })
  })
  .openapi('InsertUser')

export const userSocialLinksRelations = relations(userSocialLinks, ({ one }) => ({
  user: one(user, {
    fields: [userSocialLinks.userId],
    references: [user.id]
  })
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  })
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id]
  })
}))
