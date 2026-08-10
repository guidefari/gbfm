import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'
import { postsTable } from './post.schema'

export const externalAccountProviderEnum = ['bluesky'] as const
export const externalAccountStatusEnum = ['active', 'needs_reconnect', 'revoked', 'error'] as const
export const blueskySourceStatusEnum = [
  'active',
  'edited',
  'deleted',
  'unavailable',
  'error',
  'dismissed',
  'conflict'
] as const
export const blueskySyncRunStatusEnum = ['running', 'succeeded', 'failed'] as const

/** The encrypted envelope persisted by the application crypto service. */
export type CiphertextEnvelope = {
  readonly keyId: string
  readonly iv: string
  readonly authTag: string
  readonly payload: string
}

export const externalAccounts = sqliteTable(
  'external_accounts',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: externalAccountProviderEnum }).notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    handle: text('handle'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    issuer: text('issuer'),
    serviceEndpoint: text('service_endpoint'),
    status: text('status', { enum: externalAccountStatusEnum }).notNull().default('active'),
    lastErrorCategory: text('last_error_category'),
    lastSuccessfulSyncAt: integer('last_successful_sync_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex('external_accounts_identity_idx').on(
      table.userId,
      table.provider,
      table.providerAccountId
    ),
    index('external_accounts_owner_idx').on(table.userId, table.provider, table.status)
  ]
)

/** Secrets are isolated from presentation queries and encrypted before insertion. */
export const externalAccountSessions = sqliteTable('external_account_sessions', {
  id: text('id')
    .$defaultFn(() => crypto.randomUUID())
    .primaryKey(),
  externalAccountId: text('external_account_id')
    .notNull()
    .unique()
    .references(() => externalAccounts.id, { onDelete: 'cascade' }),
  appPassword: text('app_password', { mode: 'json' }).$type<CiphertextEnvelope>(),
  session: text('session', { mode: 'json' }).$type<CiphertextEnvelope>(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull()
})

export const blueskySyncStates = sqliteTable('bluesky_sync_states', {
  externalAccountId: text('external_account_id')
    .primaryKey()
    .references(() => externalAccounts.id, { onDelete: 'cascade' }),
  cursor: text('cursor'),
  lookbackDays: integer('lookback_days').notNull().default(90),
  scheduled: integer('scheduled', { mode: 'boolean' }).notNull().default(false),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  nextEligibleAt: integer('next_eligible_at', { mode: 'timestamp_ms' }),
  lastAttemptedAt: integer('last_attempted_at', { mode: 'timestamp_ms' }),
  lastStartedAt: integer('last_started_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull()
})

export const blueskySyncRuns = sqliteTable(
  'bluesky_sync_runs',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    externalAccountId: text('external_account_id')
      .notNull()
      .references(() => externalAccounts.id, { onDelete: 'cascade' }),
    status: text('status', { enum: blueskySyncRunStatusEnum }).notNull().default('running'),
    discovered: integer('discovered').notNull().default(0),
    qualifying: integer('qualifying').notNull().default(0),
    created: integer('created').notNull().default(0),
    alreadyImported: integer('already_imported').notNull().default(0),
    skipped: integer('skipped').notNull().default(0),
    unresolved: integer('unresolved').notNull().default(0),
    conflicted: integer('conflicted').notNull().default(0),
    failed: integer('failed').notNull().default(0),
    pageCount: integer('page_count').notNull().default(0),
    errorCategory: text('error_category'),
    startedAt: integer('started_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' })
  },
  (table) => [
    index('bluesky_sync_runs_account_started_idx').on(table.externalAccountId, table.startedAt)
  ]
)

export const blueskyPostSources = sqliteTable(
  'bluesky_post_sources',
  {
    id: text('id')
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    externalAccountId: text('external_account_id').references(() => externalAccounts.id, {
      onDelete: 'set null'
    }),
    postId: text('post_id').references(() => postsTable.id, { onDelete: 'set null' }),
    authorDid: text('author_did').notNull(),
    authorHandle: text('author_handle'),
    atUri: text('at_uri').notNull(),
    cid: text('cid'),
    publicUrl: text('public_url').notNull(),
    sourceCreatedAt: integer('source_created_at', { mode: 'timestamp_ms' }).notNull(),
    sourceStatus: text('source_status', { enum: blueskySourceStatusEnum })
      .notNull()
      .default('active'),
    sourceFingerprint: text('source_fingerprint'),
    sourceText: text('source_text'),
    sourceFacets: text('source_facets', { mode: 'json' }).$type<unknown>(),
    sourceEmbeds: text('source_embeds', { mode: 'json' }).$type<unknown>(),
    locallyEdited: integer('locally_edited', { mode: 'boolean' }).notNull().default(false),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
    lastError: text('last_error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    uniqueIndex('bluesky_post_sources_at_uri_idx').on(table.atUri),
    index('bluesky_post_sources_account_status_idx').on(
      table.externalAccountId,
      table.sourceStatus
    ),
    index('bluesky_post_sources_post_idx').on(table.postId)
  ]
)

export const externalAccountsRelations = relations(externalAccounts, ({ one, many }) => ({
  owner: one(user, { fields: [externalAccounts.userId], references: [user.id] }),
  session: one(externalAccountSessions),
  syncState: one(blueskySyncStates),
  syncRuns: many(blueskySyncRuns),
  postSources: many(blueskyPostSources)
}))

export const externalAccountSessionsRelations = relations(externalAccountSessions, ({ one }) => ({
  externalAccount: one(externalAccounts, {
    fields: [externalAccountSessions.externalAccountId],
    references: [externalAccounts.id]
  })
}))

export const blueskySyncStatesRelations = relations(blueskySyncStates, ({ one }) => ({
  externalAccount: one(externalAccounts, {
    fields: [blueskySyncStates.externalAccountId],
    references: [externalAccounts.id]
  })
}))

export const blueskySyncRunsRelations = relations(blueskySyncRuns, ({ one }) => ({
  externalAccount: one(externalAccounts, {
    fields: [blueskySyncRuns.externalAccountId],
    references: [externalAccounts.id]
  })
}))

export const blueskyPostSourcesRelations = relations(blueskyPostSources, ({ one }) => ({
  externalAccount: one(externalAccounts, {
    fields: [blueskyPostSources.externalAccountId],
    references: [externalAccounts.id]
  }),
  post: one(postsTable, {
    fields: [blueskyPostSources.postId],
    references: [postsTable.id]
  })
}))

export type SelectExternalAccount = InferSelectModel<typeof externalAccounts>
export type InsertExternalAccount = InferInsertModel<typeof externalAccounts>
export type SelectExternalAccountSession = InferSelectModel<typeof externalAccountSessions>
export type InsertExternalAccountSession = InferInsertModel<typeof externalAccountSessions>
export type SelectBlueskyPostSource = InferSelectModel<typeof blueskyPostSources>
export type InsertBlueskyPostSource = InferInsertModel<typeof blueskyPostSources>
export type SelectBlueskySyncRun = InferSelectModel<typeof blueskySyncRuns>
export type BlueskySourceStatus = SelectBlueskyPostSource['sourceStatus']
