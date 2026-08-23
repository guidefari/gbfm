import { EMAIL_DELIVERY_STATUSES } from '@gbfm/core/status'
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

/** Providers retained only as delivery-log history, not as a runtime selection mechanism. */
export const EMAIL_DELIVERY_PROVIDERS = ['ses', 'cloudflare'] as const
export type EmailDeliveryProvider = (typeof EMAIL_DELIVERY_PROVIDERS)[number]

/** Safe, closed failure categories persisted when a provider rejects or cannot accept a message. */
export const EMAIL_DELIVERY_FAILURE_CATEGORIES = [
  'invalid-message',
  'sender-not-verified',
  'recipient-not-allowed',
  'recipient-suppressed',
  'delivery-failed',
  'content-too-large',
  'unavailable'
] as const
export type EmailDeliveryFailureCategory = (typeof EMAIL_DELIVERY_FAILURE_CATEGORIES)[number]

/** Safe metadata that supports delivery-log operations without accepting arbitrary request payloads. */
export type EmailDeliveryMetadata =
  | { readonly kind: 'invite'; readonly invitedBy: string }
  | {
      readonly kind: 'mix-notification'
      readonly mixId: string
      readonly mixSlug: string
      readonly mixTitle: string
      readonly artistName: string
      readonly releaseDate: string
    }
  | { readonly kind: 'music-reminder'; readonly reminderId: string }

/** Delivery attempts and provider acceptance receipts. */
export const emailDeliveryLogsTable = sqliteTable(
  'email_delivery_logs',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text().references(() => user.id, { onDelete: 'set null' }),
    recipientEmail: text().notNull(),
    recipientName: text(),
    emailType: text().notNull(),
    templateName: text().notNull(),
    subject: text().notNull(),
    status: text().notNull().default(EMAIL_DELIVERY_STATUSES.PENDING),
    provider: text({ enum: EMAIL_DELIVERY_PROVIDERS }),
    providerMessageId: text(),
    metadata: text({ mode: 'json' }).$type<EmailDeliveryMetadata>(),
    failureCategory: text({ enum: EMAIL_DELIVERY_FAILURE_CATEGORIES }),
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

/** Per-user notification preferences. */
export const userEmailPreferencesTable = sqliteTable('user_email_preferences', {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  mixReleaseEnabled: integer({ mode: 'boolean' }).notNull().default(true),
  promotionalEnabled: integer({ mode: 'boolean' }).notNull().default(true),
  systemEnabled: integer({ mode: 'boolean' }).notNull().default(true),
  globalUnsubscribe: integer({ mode: 'boolean' }).notNull().default(false),
  unsubscribeToken: text().unique(),
  createdAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer({ mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
})

export type SelectEmailDeliveryLog = InferSelectModel<typeof emailDeliveryLogsTable>
export type InsertEmailDeliveryLog = InferInsertModel<typeof emailDeliveryLogsTable>
export type SelectAuthorEmailPreferences = InferSelectModel<typeof userEmailPreferencesTable>
export type InsertAuthorEmailPreferences = InferInsertModel<typeof userEmailPreferencesTable>

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
