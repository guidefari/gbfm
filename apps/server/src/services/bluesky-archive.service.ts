import { and, eq, isNull, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { Database } from '@/db/layer'
import { replaceEntityLabels } from '@/db/labels'
import { blueskyPostSources } from '@/db/external-account.schema'
import { postCreators, postsTable, type InsertPost } from '@/db/post.schema'
import { DatabaseError } from '@/errors'
import type { ImportedRecord } from './bluesky-importer.service'
import { MusicLinkScraperService } from './music-link-scraper.service'
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

const writeRecord = async (
  db: Database['Service'],
  input: {
    readonly ownerUserId: string
    readonly externalAccountId: string
    readonly record: ImportedRecord
    readonly musicEntityType: 'album' | 'track' | null
    readonly musicEntityId: string | null
  }
): Promise<WriteResult> => {
  const { ownerUserId, externalAccountId, record, musicEntityType, musicEntityId } = input

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existingRows = await db
      .select({
        id: blueskyPostSources.id,
        cid: blueskyPostSources.cid,
        locallyEdited: blueskyPostSources.locallyEdited,
        postId: blueskyPostSources.postId
      })
      .from(blueskyPostSources)
      .where(eq(blueskyPostSources.atUri, record.atUri))
      .limit(1)
    const existing = existingRows[0]

    if (!existing) {
      await db.batch([
        db
          .insert(blueskyPostSources)
          .values({
            id: crypto.randomUUID(),
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
      ])
      continue
    }

    const snapshot = and(
      eq(blueskyPostSources.id, existing.id),
      existing.cid === null
        ? isNull(blueskyPostSources.cid)
        : eq(blueskyPostSources.cid, existing.cid),
      eq(blueskyPostSources.locallyEdited, existing.locallyEdited),
      existing.postId === null
        ? isNull(blueskyPostSources.postId)
        : eq(blueskyPostSources.postId, existing.postId)
    )
    const changed = existing.cid !== record.cid
    const conflicted = changed && existing.locallyEdited
    const sourceStatus: 'active' | 'edited' | 'conflict' = conflicted
      ? 'conflict'
      : changed
        ? 'edited'
        : 'active'
    const sourceValues = {
      authorHandle: record.authorHandle,
      cid: record.cid,
      sourceText: record.text,
      sourceFingerprint: record.cid,
      sourceStatus,
      sourceCreatedAt: record.sourceCreatedAt,
      lastSeenAt: new Date(),
      lastError: null,
      updatedAt: new Date()
    }

    if (existing.postId) {
      const [updated] = await db.batch([
        db
          .update(blueskyPostSources)
          .set(sourceValues)
          .where(snapshot)
          .returning({ id: blueskyPostSources.id }),
        db
          .update(postsTable)
          .set({ createdAt: record.sourceCreatedAt })
          .where(
            and(
              eq(postsTable.id, existing.postId),
              sql`exists (
                select 1
                from ${blueskyPostSources}
                where ${blueskyPostSources.id} = ${existing.id}
                  and ${blueskyPostSources.cid} = ${record.cid}
                  and ${blueskyPostSources.postId} = ${existing.postId}
              )`
            )
          )
      ])
      if (updated.length > 0) return conflicted ? 'conflicted' : 'alreadyImported'
      continue
    }

    const postId = crypto.randomUUID()
    const postValues: InsertPost = {
      id: postId,
      content: record.normalizedContent,
      slug: generatePostSlug(null, record.normalizedContent),
      createdAt: record.sourceCreatedAt,
      draft: true,
      type: 'micro',
      musicEntityType,
      musicEntityId
    }
    const attached = sql`exists (
      select 1
      from ${blueskyPostSources}
      where ${blueskyPostSources.id} = ${existing.id}
        and ${blueskyPostSources.postId} = ${postId}
    )`
    const [, , updated] = await db.batch([
      db.insert(postsTable).values(postValues),
      db.insert(postCreators).values({ postId, creatorId: ownerUserId }),
      db
        .update(blueskyPostSources)
        .set({ ...sourceValues, postId })
        .where(snapshot)
        .returning({ id: blueskyPostSources.id }),
      db.delete(postCreators).where(and(eq(postCreators.postId, postId), sql`not ${attached}`)),
      db.delete(postsTable).where(and(eq(postsTable.id, postId), sql`not ${attached}`))
    ])
    if (updated.length > 0) {
      await replaceEntityLabels(db, 'post', postId, { tags: [...record.tags] })
      return 'created'
    }
  }

  throw new Error('Bluesky source changed while importing')
}

const writeEffect = ({
  ownerUserId,
  externalAccountId,
  records
}: Parameters<BlueskyArchiveService['write']>[0]) =>
  Effect.gen(function* () {
    const db = yield* Database
    const musicEntities = yield* MusicEntityService
    const scraper = yield* MusicLinkScraperService
    return yield* Effect.forEach(records, (record) =>
      Effect.gen(function* () {
        const candidateUrl = record.candidateUrls[0]
        const scraped = candidateUrl
          ? yield* scraper.scrape({ url: candidateUrl })
          : { links: [], entityMeta: undefined }
        const resolved =
          candidateUrl && scraped.entityMeta
            ? yield* musicEntities
                .scrapeAndCreateEntity(
                  scraped.entityMeta.type === 'album' ? 'album' : entityTypeForUrl(candidateUrl),
                  { url: candidateUrl }
                )
                .pipe(
                  Effect.catchTags({
                    DatabaseError: () => Effect.succeed(null),
                    ValidationError: () => Effect.succeed(null)
                  })
                )
            : null

        return yield* Effect.tryPromise({
          try: () =>
            writeRecord(db, {
              ownerUserId,
              externalAccountId,
              record,
              musicEntityType: resolved ? entityTypeForUrl(candidateUrl ?? '') : null,
              musicEntityId: resolved?.entity.id ?? null
            }),
          catch: () => databaseError
        }).pipe(Effect.catchTag('DatabaseError', () => Effect.succeed<WriteResult>('failed')))
      }).pipe(
        Effect.catchTags({
          MusicEntityResolutionUnavailable: () => Effect.succeed<WriteResult>('failed'),
          MusicScraperError: () => Effect.succeed<WriteResult>('failed')
        })
      )
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
    const db = yield* Database
    const musicEntities = yield* MusicEntityService
    const scraper = yield* MusicLinkScraperService
    return {
      write: (input) =>
        writeEffect(input).pipe(
          Effect.provideService(Database, db),
          Effect.provideService(MusicEntityService, musicEntities),
          Effect.provideService(MusicLinkScraperService, scraper)
        )
    }
  })
)
