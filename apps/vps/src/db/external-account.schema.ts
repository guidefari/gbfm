import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { user } from './auth.schema'
import { postsTable } from './post.schema'

export const externalAccountProviderEnum = pgEnum('external_account_provider', ['bluesky'])
export const externalAccountStatusEnum = pgEnum('external_account_status', [
  'active',
  'needs_reconnect',
  'revoked',
  'error'
])
export const blueskySourceStatusEnum = pgEnum('bluesky_source_status', [
  'active',
  'edited',
  'deleted',
  'unavailable',
  'error',
  'dismissed',
  'conflict'
])
export const blueskySyncRunStatusEnum = pgEnum('bluesky_sync_run_status', [
  'running',
  'succeeded',
  'failed'
])

/** The encrypted envelope persisted by the application crypto service. */
export type CiphertextEnvelope = {
  readonly keyId: string
  readonly iv: string
  readonly authTag: string
  readonly payload: string
}

export const externalAccounts = pgTable(
  'external_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: externalAccountProviderEnum('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    handle: text('handle'),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    issuer: text('issuer'),
    serviceEndpoint: text('service_endpoint'),
    status: externalAccountStatusEnum('status').notNull().default('active'),
    lastErrorCategory: text('last_error_category'),
    lastSuccessfulSyncAt: timestamp('last_successful_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
export const externalAccountSessions = pgTable('external_account_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  externalAccountId: uuid('external_account_id')
    .notNull()
    .unique()
    .references(() => externalAccounts.id, { onDelete: 'cascade' }),
  appPassword: jsonb('app_password').$type<CiphertextEnvelope>(),
  session: jsonb('session').$type<CiphertextEnvelope>(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

export const blueskySyncStates = pgTable('bluesky_sync_states', {
  externalAccountId: uuid('external_account_id')
    .primaryKey()
    .references(() => externalAccounts.id, { onDelete: 'cascade' }),
  cursor: text('cursor'),
  lookbackDays: integer('lookback_days').notNull().default(90),
  scheduled: boolean('scheduled').notNull().default(false),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  nextEligibleAt: timestamp('next_eligible_at', { withTimezone: true }),
  lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
  lastStartedAt: timestamp('last_started_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull()
})

export const blueskySyncRuns = pgTable(
  'bluesky_sync_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalAccountId: uuid('external_account_id')
      .notNull()
      .references(() => externalAccounts.id, { onDelete: 'cascade' }),
    status: blueskySyncRunStatusEnum('status').notNull().default('running'),
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
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true })
  },
  (table) => [
    index('bluesky_sync_runs_account_started_idx').on(table.externalAccountId, table.startedAt)
  ]
)

export const blueskyPostSources = pgTable(
  'bluesky_post_sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    externalAccountId: uuid('external_account_id').references(() => externalAccounts.id, {
      onDelete: 'set null'
    }),
    postId: uuid('post_id').references(() => postsTable.id, { onDelete: 'set null' }),
    authorDid: text('author_did').notNull(),
    authorHandle: text('author_handle'),
    atUri: text('at_uri').notNull(),
    cid: text('cid'),
    publicUrl: text('public_url').notNull(),
    sourceCreatedAt: timestamp('source_created_at', { withTimezone: true }).notNull(),
    sourceStatus: blueskySourceStatusEnum('source_status').notNull().default('active'),
    sourceFingerprint: text('source_fingerprint'),
    sourceText: text('source_text'),
    sourceFacets: jsonb('source_facets'),
    sourceEmbeds: jsonb('source_embeds'),
    locallyEdited: boolean('locally_edited').notNull().default(false),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
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
