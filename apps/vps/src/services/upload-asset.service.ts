import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { type SelectUploadAsset, uploadAssetsTable } from '@/db/upload-asset.schema'
import { DatabaseError, getErrorMessage } from '@/errors'
import { ConfigService } from '@/services/config.service'

// Rows created here are informational for a future cleanup job -- the upload
// flow itself never reads this table back to authorize anything (S3 key
// ownership/expected-size checks in upload.handlers.ts stay the source of
// truth, unchanged by this table's existence). Every write below is
// deliberately best-effort: a DatabaseError here must never fail the upload
// or content-save request it's attached to, since that would turn an
// observability nice-to-have into a new way to break uploads on a
// production app. Handlers should log-and-continue on failure, not propagate.
export interface CreatePendingAssetInput {
  readonly userId: string
  readonly key: string
  readonly bucket: string
  readonly assetType: 'image' | 'audio'
  readonly uploadId?: string
  readonly expectedSize?: number
  readonly expiresInSeconds: number
}

export interface UploadAssetService {
  readonly createPending: (
    input: CreatePendingAssetInput
  ) => Effect.Effect<SelectUploadAsset, DatabaseError>

  readonly markUploaded: (key: string) => Effect.Effect<void, DatabaseError>

  readonly markAttached: (
    key: string,
    attachedToTable: string,
    attachedToId: string
  ) => Effect.Effect<void, DatabaseError>
}

export const UploadAssetService = Context.Service<UploadAssetService>('UploadAssetService')

const createPendingEffect = (input: CreatePendingAssetInput) =>
  Effect.gen(function* () {
    const now = Date.now()
    const expiresAt = new Date(now + input.expiresInSeconds * 1000)

    const inserted = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(uploadAssetsTable)
          .values({
            userId: input.userId,
            key: input.key,
            bucket: input.bucket,
            assetType: input.assetType,
            uploadId: input.uploadId,
            expectedSize: input.expectedSize,
            status: 'pending',
            expiresAt
          })
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create pending upload asset: ${getErrorMessage(error)}`,
          operation: 'insert',
          table: 'upload_assets'
        })
    })

    const asset = inserted[0]
    if (!asset) {
      return yield* new DatabaseError({
        message: 'Failed to create pending upload asset: no row returned',
        operation: 'insert',
        table: 'upload_assets'
      })
    }

    return asset
  }).pipe(Effect.withSpan('uploadAsset.createPending', { attributes: { key: input.key } }))

const markUploadedEffect = (key: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(uploadAssetsTable)
        .set({ status: 'uploaded' })
        .where(and(eq(uploadAssetsTable.key, key), eq(uploadAssetsTable.status, 'pending'))),
    catch: (error) =>
      new DatabaseError({
        message: `Failed to mark upload asset uploaded: ${getErrorMessage(error)}`,
        operation: 'update',
        table: 'upload_assets'
      })
  }).pipe(Effect.asVoid, Effect.withSpan('uploadAsset.markUploaded', { attributes: { key } }))

// Guards the transition the same way markUploadedEffect does: WHERE
// status='uploaded' only. This makes a repeat markAttached call on an
// already-attached key a silent no-op (the row is no longer 'uploaded', so
// the WHERE matches zero rows) instead of overwriting attachedToTable/
// attachedToId, and it keeps a hypothetical future 'expired' row (S3 object
// possibly already reclaimed by a cleanup job) from ever being flipped to
// 'attached'.
const markAttachedEffect = (key: string, attachedToTable: string, attachedToId: string) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(uploadAssetsTable)
        .set({ status: 'attached', attachedToTable, attachedToId })
        .where(and(eq(uploadAssetsTable.key, key), eq(uploadAssetsTable.status, 'uploaded'))),
    catch: (error) =>
      new DatabaseError({
        message: `Failed to mark upload asset attached: ${getErrorMessage(error)}`,
        operation: 'update',
        table: 'upload_assets'
      })
  }).pipe(
    Effect.asVoid,
    Effect.withSpan('uploadAsset.markAttached', { attributes: { key, attachedToTable } })
  )

export const UploadAssetServiceLayer = Layer.succeed(UploadAssetService, {
  createPending: createPendingEffect,
  markUploaded: markUploadedEffect,
  markAttached: markAttachedEffect
})

// Content records store the full public URL (e.g. `${bucketRouter}/user-
// content/${key}`, see upload.handlers.ts's presignImage/completeMultipartUpload
// responses), not the raw S3 key upload_assets.key is keyed on. Returns null
// for any URL that isn't one of this bucket's own upload URLs (an externally
// hosted image picked via a different flow, a pre-migration URL, ...) so
// callers can skip the attach lookup entirely instead of querying with a key
// that could never match a row.
export const keyFromAssetUrl = (url: string, bucketRouterUrl: string): string | null => {
  const prefix = `${bucketRouterUrl}/user-content/`
  return url.startsWith(prefix) ? url.slice(prefix.length) : null
}

// Shared by every content service's create path (audio.service.ts,
// post.service.ts, ...) that saves a URL which may point at a freshly
// uploaded asset. Best-effort and silent-on-miss by design: most URLs
// passed in (bucket-browser picks, a show's inherited thumbnail, content
// predating this table) won't have a matching upload_assets row, and that's
// the expected common case, not something worth logging per call. A real
// DatabaseError while attempting the update is still logged (not silently
// dropped) since that indicates the table/query itself is broken.
export const markAttachedAssets = (
  attachedToTable: string,
  attachedToId: string,
  urls: ReadonlyArray<string | null | undefined>
) =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    const uploadAssetService = yield* UploadAssetService

    const keys = urls
      .filter((url): url is string => Boolean(url))
      .map((url) => keyFromAssetUrl(url, config.urls.bucketRouter))
      .filter((key): key is string => key !== null)

    for (const key of keys) {
      yield* uploadAssetService
        .markAttached(key, attachedToTable, attachedToId)
        .pipe(
          Effect.catchTag('DatabaseError', (cause) =>
            Effect.logError('[upload-asset] failed to mark upload_assets attached', cause)
          )
        )
    }
  })
