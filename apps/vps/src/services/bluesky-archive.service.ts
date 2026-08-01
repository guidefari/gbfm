import { eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { blueskyPostSources } from '@/db/external-account.schema'
import { postCreators, postsTable, type InsertPost } from '@/db/post.schema'
import { DatabaseError } from '@/errors'
import type { ImportedRecord } from './bluesky-importer.service'
import { generatePostSlug } from './post.service'

export type ArchiveImportSummary = {
  readonly created: number
  readonly alreadyImported: number
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

type WriteResult = 'created' | 'alreadyImported' | 'failed'

const write = ({
  ownerUserId,
  externalAccountId,
  records
}: Parameters<BlueskyArchiveService['write']>[0]) =>
  Effect.forEach(records, (record) =>
    Effect.tryPromise({
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
          if (!source) return 'alreadyImported'

          const postValues: InsertPost = {
            content: record.normalizedContent,
            slug: generatePostSlug(null, record.normalizedContent),
            draft: true,
            tags: [...record.tags],
            type: 'micro'
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
  ).pipe(
    Effect.map((results) => ({
      created: results.filter((result) => result === 'created').length,
      alreadyImported: results.filter((result) => result === 'alreadyImported').length,
      failed: results.filter((result) => result === 'failed').length
    }))
  )

export const BlueskyArchiveServiceLayer = Layer.succeed(BlueskyArchiveService, { write })
