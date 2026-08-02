import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { blueskyPostSources } from '@/db/external-account.schema'
import { postCreators, postsTable, type InsertPost } from '@/db/post.schema'
import { DatabaseError } from '@/errors'
import type { ImportedRecord } from './bluesky-importer.service'
import { MusicEntityService } from './music-entity'
import { generatePostSlug } from './post.service'

export type ArchiveImportSummary = {
  readonly created: number
  readonly alreadyImported: number
  readonly conflicted: number
  readonly failed: number
}

export interface BlueskyArchiveService {
  readonly write: (input: {
    readonly ownerUserId: string
    readonly externalAccountId: string
    readonly records: ReadonlyArray<ImportedRecord>
  }) => Effect.Effect<ArchiveImportSummary, DatabaseError>
}

export const BlueskyArchiveService = Context.Service<BlueskyArchiveService>('BlueskyArchiveService')

const databaseError = new DatabaseError({
  message: 'Unable to write Bluesky archive',
  operation: 'import-archive'
})

type WriteResult = 'created' | 'alreadyImported' | 'conflicted' | 'failed'

const entityTypeForUrl = (url: string): 'album' | 'track' =>
  /\/album(?:s)?\//i.test(url) ? 'album' : 'track'

const makeWrite = (musicEntities: MusicEntityService) => ({
  write: ({
    ownerUserId,
    externalAccountId,
    records
  }: Parameters<BlueskyArchiveService['write']>[0]) =>
    Effect.forEach(records, (record) =>
      Effect.gen(function* () {
        const candidateUrl = record.candidateUrls[0]
        const resolved = candidateUrl
          ? yield* musicEntities
              .scrapeAndCreateEntity(entityTypeForUrl(candidateUrl), { url: candidateUrl })
              .pipe(Effect.catch(() => Effect.succeed(null)))
          : null

        return yield* Effect.tryPromise({
          try: () =>
            db.transaction(async (tx) => {
              const [source] = await tx
                .insert(blueskyPostSources)
                .values({
                  externalAccountId,
                  authorDid: record.authorDid,
                  authorHandle: record.authorHandle,
                  atUri: record.atUri,
                  cid: record.cid,
                  publicUrl: record.publicUrl,
                  sourceCreatedAt: record.sourceCreatedAt,
                  sourceText: record.text,
                  sourceFingerprint: record.cid,
                  lastSeenAt: new Date()
                })
                .onConflictDoNothing({ target: blueskyPostSources.atUri })
                .returning()
              if (!source) {
                const [existing] = await tx
                  .select({
                    id: blueskyPostSources.id,
                    cid: blueskyPostSources.cid,
                    locallyEdited: blueskyPostSources.locallyEdited
                  })
                  .from(blueskyPostSources)
                  .where(eq(blueskyPostSources.atUri, record.atUri))
                  .limit(1)
                if (!existing) throw databaseError
                const changed = existing.cid !== record.cid
                const conflicted = changed && existing.locallyEdited
                await tx
                  .update(blueskyPostSources)
                  .set({
                    authorHandle: record.authorHandle,
                    cid: record.cid,
                    sourceText: record.text,
                    sourceFingerprint: record.cid,
                    sourceStatus: conflicted ? 'conflict' : changed ? 'edited' : 'active',
                    lastSeenAt: new Date(),
                    lastError: null,
                    updatedAt: new Date()
                  })
                  .where(eq(blueskyPostSources.id, existing.id))
                return conflicted ? 'conflicted' : 'alreadyImported'
              }

              const postValues: InsertPost = {
                content: record.normalizedContent,
                slug: generatePostSlug(null, record.normalizedContent),
                draft: true,
                tags: [...record.tags],
                type: 'micro',
                musicEntityType: resolved ? entityTypeForUrl(candidateUrl ?? '') : null,
                musicEntityId: resolved?.entity.id ?? null
              }
              const [post] = await tx.insert(postsTable).values(postValues).returning()
              if (!post) throw databaseError

              await tx.insert(postCreators).values({ postId: post.id, creatorId: ownerUserId })
              await tx
                .update(blueskyPostSources)
                .set({ postId: post.id })
                .where(eq(blueskyPostSources.id, source.id))
              return 'created'
            }),
          catch: () => databaseError
        }).pipe(Effect.catchTag('DatabaseError', () => Effect.succeed<WriteResult>('failed')))
      })
    ).pipe(
      Effect.map((results) => ({
        created: results.filter((result) => result === 'created').length,
        alreadyImported: results.filter((result) => result === 'alreadyImported').length,
        conflicted: results.filter((result) => result === 'conflicted').length,
        failed: results.filter((result) => result === 'failed').length
      }))
    )
})

export const BlueskyArchiveServiceLayer = Layer.effect(
  BlueskyArchiveService,
  Effect.gen(function* () {
    return makeWrite(yield* MusicEntityService)
  })
)
