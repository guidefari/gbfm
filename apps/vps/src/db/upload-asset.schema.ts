import { type InferInsertModel, type InferSelectModel, relations } from 'drizzle-orm'
import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'

// Lifecycle: pending (presigned URL/multipart upload issued, bytes not yet
// confirmed in S3) -> uploaded (S3 confirms the object exists -- multipart
// completeMultipartUpload, or an image PUT the browser reports as ok) ->
// attached (the key is now referenced by a real content record -- audio.url,
// audio.thumbnailUrl, posts.thumbnailUrl, ...) -> expired (pending too long,
// eligible for a future cleanup job to reclaim the orphaned S3 object).
//
// No cleanup job is implemented here (out of scope for #131's asset-lifecycle
// task) -- this table only records enough (createdAt/expiresAt) for a future
// job to find stale `pending`/`uploaded` rows and delete their S3 objects.
export const uploadAssetStatusEnum = ['pending', 'uploaded', 'attached', 'expired'] as const

export const uploadAssetTypeEnum = ['image', 'audio'] as const

export const uploadAssetsTable = sqliteTable(
  'upload_assets',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    bucket: text('bucket').notNull(),
    assetType: text('asset_type', { enum: uploadAssetTypeEnum }).notNull(),
    status: text('status', { enum: uploadAssetStatusEnum }).default('pending').notNull(),
    // S3 multipart upload id -- set for the audio multipart path, null for
    // the image single-PUT path (there is no multipart "upload session" to
    // track for a single PUT).
    uploadId: text('upload_id'),
    expectedSize: integer('expected_size'),
    // Free-text pointer rather than a real FK: this table has to reference
    // whichever content table ends up owning the asset (audio, posts, shows,
    // ...), and those tables don't share a common parent to FK against. Kept
    // deliberately loose (matches this repo's existing music_entity_links
    // free-text-entityType pattern) rather than adding a real polymorphic-FK
    // abstraction for a field a future cleanup job only needs to read, not
    // join on.
    attachedToTable: text('attached_to_table'),
    attachedToId: text('attached_to_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .$defaultFn(() => new Date())
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    // Populated at insert time (createdAt + a fixed pending-window constant
    // owned by the upload handlers, not this schema file) so a future cleanup
    // job can select on it directly instead of recomputing per row.
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
  },
  (table) => [
    unique('upload_assets_key_unique').on(table.key),
    index('upload_assets_user_id_idx').on(table.userId),
    index('upload_assets_status_idx').on(table.status),
    index('upload_assets_expires_at_idx').on(table.expiresAt),
    index('upload_assets_attached_to_idx').on(table.attachedToTable, table.attachedToId)
  ]
)

export const uploadAssetsRelations = relations(uploadAssetsTable, ({ one }) => ({
  user: one(user, {
    fields: [uploadAssetsTable.userId],
    references: [user.id]
  })
}))

export type SelectUploadAsset = InferSelectModel<typeof uploadAssetsTable>
export type InsertUploadAsset = InferInsertModel<typeof uploadAssetsTable>
