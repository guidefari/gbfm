import { EMAIL_DELIVERY_STATUS_VALUES, EMAIL_DELIVERY_STATUSES } from '@gbfm/core/status'
import { z } from 'zod'
import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
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
export const emailDeliveryLogsTable = sqliteTable(
  'email_delivery_logs',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text().references(() => user.id, { onDelete: 'set null' }), // null for non-user emails
    recipientEmail: text().notNull(),
    recipientName: text(),
    emailType: text().notNull(),
    templateName: text().notNull(),
    subject: text().notNull(),
    status: text().notNull().default(EMAIL_DELIVERY_STATUSES.PENDING),
    sesMessageId: text(),
    metadata: text({ mode: 'json' }).$type<Record<string, unknown>>(),
    errorMessage: text(),
    sentAt: integer({ mode: 'timestamp_ms' }),
    deliveredAt: integer({ mode: 'timestamp_ms' }),
    bouncedAt: integer({ mode: 'timestamp_ms' }),
    complainedAt: integer({ mode: 'timestamp_ms' }),
    createdAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer({ mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
  },
  (table) => [
    index('email_delivery_logs_userId_idx').on(table.userId),
    index('email_delivery_logs_recipientEmail_idx').on(table.recipientEmail),
    index('email_delivery_logs_status_idx').on(table.status),
    index('email_delivery_logs_createdAt_idx').on(table.createdAt)
  ]
)

// Author email preferences table - manages user notification settings
export const userEmailPreferencesTable = sqliteTable('user_email_preferences', {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Notification preferences
  mixReleaseEnabled: integer({ mode: 'boolean' }).notNull().default(true),
  promotionalEnabled: integer({ mode: 'boolean' }).notNull().default(true),
  systemEnabled: integer({ mode: 'boolean' }).notNull().default(true),
  // Global settings
  globalUnsubscribe: integer({ mode: 'boolean' }).notNull().default(false), // Opt-out of all non-transactional emails
  // Metadata
  unsubscribeToken: text().unique(), // Token for unsubscribe links
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
})

// Type exports for Drizzle
export type SelectEmailDeliveryLog = InferSelectModel<typeof emailDeliveryLogsTable>
export type InsertEmailDeliveryLog = InferInsertModel<typeof emailDeliveryLogsTable>
export type SelectAuthorEmailPreferences = InferSelectModel<typeof userEmailPreferencesTable>
export type InsertAuthorEmailPreferences = InferInsertModel<typeof userEmailPreferencesTable>

// Zod schemas for API validation
const emailDeliveryStatusEnum = z.enum(EMAIL_DELIVERY_STATUS_VALUES)

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
export const emailDeliveryLogsRelations = relations(emailDeliveryLogsTable, ({ one }) => ({
  user: one(user, {
    fields: [emailDeliveryLogsTable.userId],
    references: [user.id]
  })
}))

export const authorEmailPreferencesRelations = relations(userEmailPreferencesTable, ({ one }) => ({
  user: one(user, {
    fields: [userEmailPreferencesTable.userId],
    references: [user.id]
  })
}))
