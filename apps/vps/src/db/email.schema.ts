import {
  EMAIL_DELIVERY_STATUS_VALUES,
  EMAIL_DELIVERY_STATUSES
} from '@gbfm/core/status'
import { z } from '@hono/zod-openapi'
import {
  type InferInsertModel,
  type InferSelectModel,
  relations
} from 'drizzle-orm'
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'

export const EMAIL_NOTIFICATION_TYPES = {
  TRANSACTIONAL: 'TRANSACTIONAL',
  MIX_RELEASE: 'MIX_RELEASE',
  PROMOTIONAL: 'PROMOTIONAL',
  SYSTEM: 'SYSTEM'
} as const

export type EmailNotificationType =
  (typeof EMAIL_NOTIFICATION_TYPES)[keyof typeof EMAIL_NOTIFICATION_TYPES]

// Email delivery logs table - tracks all email sending attempts
export const emailDeliveryLogsTable = pgTable(
  'email_delivery_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().references(() => user.id, { onDelete: 'set null' }), // null for non-user emails
    recipientEmail: varchar({ length: 255 }).notNull(),
    recipientName: varchar({ length: 255 }),
    emailType: varchar({ length: 50 }).notNull(),
    templateName: varchar({ length: 100 }).notNull(), // e.g., 'welcome', 'mix-notification'
    subject: varchar({ length: 500 }).notNull(),
    status: varchar({ length: 50 })
      .notNull()
      .default(EMAIL_DELIVERY_STATUSES.PENDING),
    sesMessageId: varchar({ length: 255 }), // SES response message ID
    metadata: jsonb(), // Additional context (mix ID, etc.)
    errorMessage: text(), // Error details if failed
    sentAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    bouncedAt: timestamp({ withTimezone: true }),
    complainedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index('email_delivery_logs_userId_idx').on(table.userId),
    index('email_delivery_logs_recipientEmail_idx').on(table.recipientEmail),
    index('email_delivery_logs_status_idx').on(table.status),
    index('email_delivery_logs_createdAt_idx').on(table.createdAt)
  ]
)

// Author email preferences table - manages user notification settings
export const userEmailPreferencesTable = pgTable('user_email_preferences', {
  id: uuid().primaryKey().defaultRandom(),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Notification preferences
  mixReleaseEnabled: boolean().notNull().default(true),
  promotionalEnabled: boolean().notNull().default(true),
  systemEnabled: boolean().notNull().default(true),
  // Global settings
  globalUnsubscribe: boolean().notNull().default(false), // Opt-out of all non-transactional emails
  // Metadata
  unsubscribeToken: uuid().unique(), // Token for unsubscribe links
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
})

// Type exports for Drizzle
export type SelectEmailDeliveryLog = InferSelectModel<
  typeof emailDeliveryLogsTable
>
export type InsertEmailDeliveryLog = InferInsertModel<
  typeof emailDeliveryLogsTable
>
export type SelectAuthorEmailPreferences = InferSelectModel<
  typeof userEmailPreferencesTable
>
export type InsertAuthorEmailPreferences = InferInsertModel<
  typeof userEmailPreferencesTable
>

// Zod schemas for API validation
const emailDeliveryStatusEnum = z
  .enum(EMAIL_DELIVERY_STATUS_VALUES)
  .openapi('EmailDeliveryStatus')

export const selectEmailDeliveryLogSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  recipientEmail: z.string(),
  recipientName: z.string().nullable(),
  emailType: z.enum(['TRANSACTIONAL', 'MIX_RELEASE', 'PROMOTIONAL', 'SYSTEM']),
  templateName: z.string(),
  subject: z.string(),
  status: emailDeliveryStatusEnum,
  sesMessageId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  errorMessage: z.string().nullable(),
  sentAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  bouncedAt: z.date().nullable(),
  complainedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const insertEmailDeliveryLogSchema = z.object({
  userId: z.string().optional(),
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  emailType: z.enum(['TRANSACTIONAL', 'MIX_RELEASE', 'PROMOTIONAL', 'SYSTEM']),
  templateName: z.string(),
  subject: z.string(),
  status: emailDeliveryStatusEnum.optional(),
  sesMessageId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  errorMessage: z.string().optional(),
  sentAt: z.date().optional(),
  deliveredAt: z.date().optional(),
  bouncedAt: z.date().optional(),
  complainedAt: z.date().optional()
})

export const selectAuthorEmailPreferencesSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mixReleaseEnabled: z.boolean(),
  promotionalEnabled: z.boolean(),
  systemEnabled: z.boolean(),
  globalUnsubscribe: z.boolean(),
  unsubscribeToken: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
})

export const insertAuthorEmailPreferencesSchema = z.object({
  userId: z.string(),
  mixReleaseEnabled: z.boolean().optional(),
  promotionalEnabled: z.boolean().optional(),
  systemEnabled: z.boolean().optional(),
  globalUnsubscribe: z.boolean().optional(),
  unsubscribeToken: z.string().optional()
})

export const updateAuthorEmailPreferencesSchema = z.object({
  mixReleaseEnabled: z.boolean().optional(),
  promotionalEnabled: z.boolean().optional(),
  systemEnabled: z.boolean().optional(),
  globalUnsubscribe: z.boolean().optional()
})

// Relations
export const emailDeliveryLogsRelations = relations(
  emailDeliveryLogsTable,
  ({ one }) => ({
    user: one(user, {
      fields: [emailDeliveryLogsTable.userId],
      references: [user.id]
    })
  })
)

export const authorEmailPreferencesRelations = relations(
  userEmailPreferencesTable,
  ({ one }) => ({
    user: one(user, {
      fields: [userEmailPreferencesTable.userId],
      references: [user.id]
    })
  })
)
