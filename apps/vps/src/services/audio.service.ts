import { and, arrayContains, count, desc, eq, exists, sql } from 'drizzle-orm'
import { Context, Crypto, Effect, Encoding, Layer } from 'effect'
import { db } from '@/db'
import {
  audioCreators,
  audioTable,
  type InsertAudio,
  type SelectAudio,
  type SelectMdxCompiledAudio
} from '@/db/audio.schema'
import { timeQuery } from '@/db/query-timer'
import { showsTable } from '@/db/show.schema'
import {
  ConflictError,
  DatabaseError,
  getErrorMessage,
  NotFoundError,
  type UnauthorizedError
} from '@/errors'
import { requireCreatorOrAdmin } from '@/lib/authorization'
import { CryptoLive } from '@/lib/crypto'
import { MdxService } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'
import { recordAudioCreate } from '@/lib/performance-monitoring'
import { ConfigService } from '@/services/config.service'
import { markAttachedAssets, UploadAssetService } from '@/services/upload-asset.service'

type AudioType = 'mix' | 'track' | 'misc'
type CreateAudioData = InsertAudio

type CreateAudioOptions = {
  actorId: string
  idempotencyKey: string
}

class AudioCreateConflict extends Error {
  constructor() {
    super('Audio create conflict')
  }
}

const canonicalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    )
  }
  return value
}

export const createAudioFingerprint = (data: CreateAudioData, creatorIds: readonly string[]) =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto
    const input = new TextEncoder().encode(
      JSON.stringify(canonicalize({ data, creatorIds: [...creatorIds].toSorted() }))
    )
    return yield* crypto.digest('SHA-256', input).pipe(Effect.orDie, Effect.map(Encoding.encodeHex))
  })

type AudioWithCreators = SelectAudio & {
  creators: Array<{
    id: string
    name: string
    username: string | null
  }>
}

export interface AudioService {
  readonly getByType: (
    type: AudioType,
    options: { limit: number; offset: number; tag?: string }
  ) => Effect.Effect<{ data: AudioWithCreators[]; pagination: PaginationMetadata }, DatabaseError>
  readonly getByTypeForEdit: (
    type: AudioType,
    options: { limit: number; offset: number; tag?: string },
    userId: string,
    userRole: string
  ) => Effect.Effect<{ data: AudioWithCreators[]; pagination: PaginationMetadata }, DatabaseError>
  readonly getTags: (type: AudioType) => Effect.Effect<string[], DatabaseError>
  readonly getBySlug: (
    type: AudioType,
    slug: string
  ) => Effect.Effect<SelectMdxCompiledAudio, DatabaseError | NotFoundError>
  readonly getBySlugForEdit: (
    type: AudioType,
    slug: string,
    userId: string,
    userRole: string
  ) => Effect.Effect<SelectMdxCompiledAudio, DatabaseError | NotFoundError | UnauthorizedError>
  readonly create: (
    data: CreateAudioData,
    creatorIds: string[],
    options: CreateAudioOptions
  ) => Effect.Effect<SelectAudio, DatabaseError | ConflictError>
  readonly update: (
    type: AudioType,
    slug: string,
    userId: string,
    userRole: string,
    data: Partial<InsertAudio> & { creatorIds?: string[] }
  ) => Effect.Effect<SelectMdxCompiledAudio, DatabaseError | NotFoundError | UnauthorizedError>
  readonly trackPlay: (
    id: string,
    clientIp?: string
  ) => Effect.Effect<{ playCount: number }, DatabaseError | NotFoundError>
}

export const AudioService = Context.Service<AudioService>('AudioService')

const getByTypeEffect = (
  type: AudioType,
  options: { limit: number; offset: number; tag?: string },
  actor?: { userId: string; userRole: string }
) =>
  Effect.gen(function* () {
    const { limit, offset, tag } = options
    yield* Effect.annotateCurrentSpan('audio.type', type)
    yield* Effect.annotateCurrentSpan('audio.limit', limit)
    yield* Effect.annotateCurrentSpan('audio.offset', offset)
    if (tag) yield* Effect.annotateCurrentSpan('audio.tag', tag)
    const visibilityCondition = actor
      ? actor.userRole === 'admin'
        ? undefined
        : exists(
            db
              .select({ id: audioCreators.audioId })
              .from(audioCreators)
              .where(
                and(
                  eq(audioCreators.audioId, audioTable.id),
                  eq(audioCreators.creatorId, actor.userId)
                )
              )
          )
      : eq(audioTable.draft, false)
    const whereCondition = and(
      eq(audioTable.type, type),
      visibilityCondition,
      tag ? arrayContains(audioTable.tags, [tag]) : undefined
    )

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () => db.select({ total: count() }).from(audioTable).where(whereCondition),
          'get-audio-by-type-count'
        ),
      catch: (error) =>
        error instanceof Error
          ? new DatabaseError({
              message: `Failed to count audio: ${error.message}`,
              operation: 'select',
              table: 'audio'
            })
          : new DatabaseError({
              message: `Failed to count audio: Unknown error: ${String(error)}`,
              operation: 'select',
              table: 'audio'
            })
    })

    const total = countResult[0]?.total ?? 0

    const audioItems = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db.query.audioTable.findMany({
              where: whereCondition,
              limit,
              offset,
              orderBy: desc(audioTable.createdAt),
              with: {
                audioCreators: {
                  with: { creator: true }
                },
                show: {
                  columns: { thumbnailUrl: true }
                }
              }
            }),
          'get-audio-by-type-data'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch audio: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const data = audioItems.map(({ audioCreators: creators, show, ...audio }) => ({
      ...audio,
      thumbnailUrl: audio.thumbnailUrl ?? show?.thumbnailUrl ?? null,
      creators: creators.map(({ creator }) => ({
        id: creator.id,
        name: creator.name,
        username: creator.username
      }))
    }))

    return {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const getTagsEffect = (type: AudioType) =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .selectDistinct({
            tag: sql<string | null>`unnest(${audioTable.tags})`
          })
          .from(audioTable)
          .where(and(eq(audioTable.type, type), eq(audioTable.draft, false))),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch audio tags: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    return rows
      .map((r) => r.tag)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .toSorted()
  })

const getBySlugEffect = (type: AudioType, slug: string, mdx: MdxService, includeDrafts = false) =>
  Effect.gen(function* () {
    const audio = yield* Effect.tryPromise({
      try: () =>
        db.query.audioTable.findFirst({
          where: includeDrafts
            ? and(eq(audioTable.type, type), eq(audioTable.slug, slug))
            : and(
                eq(audioTable.type, type),
                eq(audioTable.slug, slug),
                eq(audioTable.draft, false)
              ),
          with: {
            audioCreators: {
              with: { creator: true }
            },
            show: {
              columns: { thumbnailUrl: true }
            }
          }
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch audio: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    if (!audio) {
      return yield* new NotFoundError({
        message: 'Audio not found',
        resource: 'audio',
        id: slug
      })
    }

    let compiledContent = ''
    if (audio.content) {
      compiledContent = yield* mdx.compile(audio.content).pipe(Effect.orElseSucceed(() => ''))
    }

    const { audioCreators: creators, show, ...audioFields } = audio

    return {
      ...audioFields,
      thumbnailUrl: audioFields.thumbnailUrl ?? show?.thumbnailUrl ?? null,
      compiledContent,
      creators: creators.map(({ creator }) => ({
        id: creator.id,
        name: creator.name,
        username: creator.username
      }))
    }
  })

const createEffect = (
  data: CreateAudioData,
  creatorIds: string[],
  { actorId, idempotencyKey }: CreateAudioOptions
) =>
  Effect.gen(function* () {
    const idempotencyFingerprint = yield* createAudioFingerprint(data, creatorIds)
    // thumbnailUrl is intentionally left as-is (NULL when not provided): the
    // show's artwork is resolved at read time instead of copied here, so
    // episodes stay in sync when a show's art changes later.
    const audioData = { ...data }

    const result = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db.transaction(async (tx) => {
              const [insertedAudio] = await tx
                .insert(audioTable)
                .values({
                  ...audioData,
                  idempotencyKey,
                  idempotencyActorId: actorId,
                  idempotencyFingerprint
                })
                .onConflictDoNothing()
                .returning()

              if (!insertedAudio) {
                const [replayedAudio] = await tx
                  .select()
                  .from(audioTable)
                  .where(
                    and(
                      eq(audioTable.idempotencyActorId, actorId),
                      eq(audioTable.idempotencyKey, idempotencyKey)
                    )
                  )
                  .limit(1)

                if (!replayedAudio) {
                  throw new AudioCreateConflict()
                }
                if (replayedAudio.idempotencyFingerprint !== idempotencyFingerprint) {
                  throw new AudioCreateConflict()
                }

                return { audio: replayedAudio, created: false }
              }

              await tx.insert(audioCreators).values(
                creatorIds.map((creatorId) => ({
                  audioId: insertedAudio.id,
                  creatorId
                }))
              )

              return { audio: insertedAudio, created: true }
            }),
          'create-audio-transaction'
        ),
      catch: (error) => {
        const errorMessage = getErrorMessage(error)
        if (error instanceof AudioCreateConflict || errorMessage.includes('unique constraint')) {
          return new ConflictError({
            message: 'Audio with this slug already exists',
            resource: 'audio'
          })
        }
        if (errorMessage.includes('foreign key constraint')) {
          return new ConflictError({
            message: 'You may have entered a non-existent creator id',
            resource: 'audio'
          })
        }
        return new DatabaseError({
          message: `Failed to create audio: ${errorMessage}`,
          operation: 'transaction',
          table: 'audio'
        })
      }
    })

    yield* Effect.annotateCurrentSpan('audioId', result.audio.id)
    yield* Effect.annotateCurrentSpan('audioType', result.audio.type)
    yield* Effect.annotateCurrentSpan('creatorCount', creatorIds.length)
    yield* Effect.annotateCurrentSpan('idempotencyReplay', !result.created)

    if (result.created) {
      yield* recordAudioCreate()

      yield* Effect.logInfo('[Content] Audio created', {
        audioId: result.audio.id,
        type: result.audio.type,
        title: result.audio.title,
        slug: result.audio.slug,
        creatorCount: creatorIds.length
      })

      yield* markAttachedAssets('audio', result.audio.id, [
        result.audio.url,
        result.audio.thumbnailUrl
      ])
    }

    return result.audio
  })

const updateEffect = (
  type: AudioType,
  slug: string,
  userId: string,
  userRole: string,
  data: Partial<InsertAudio> & { creatorIds?: string[] },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(audioTable)
          .where(and(eq(audioTable.type, type), eq(audioTable.slug, slug)))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check audio existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const existingAudio = existingRecords[0]
    if (!existingAudio) {
      return yield* new NotFoundError({
        message: 'Audio not found',
        resource: 'audio',
        id: slug
      })
    }

    yield* requireCreatorOrAdmin('audio', existingAudio.id, userId, userRole)

    const { creatorIds, ...updateData } = data
    let updatedAudio = existingAudio

    if (Object.keys(updateData).length > 0) {
      const updatedRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .update(audioTable)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(audioTable.id, existingAudio.id))
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update audio: ${getErrorMessage(error)}`,
            operation: 'update',
            table: 'audio'
          })
      })

      if (!updatedRecords[0]) {
        return yield* new DatabaseError({
          message: 'Failed to update audio',
          operation: 'update',
          table: 'audio'
        })
      }
      updatedAudio = updatedRecords[0]

      // An image/audio file attached via an edit form (not just at create
      // time) still needs its upload_assets row moved out of 'pending', or
      // it looks reclaimable to a future cleanup job despite being in use.
      yield* markAttachedAssets('audio', updatedAudio.id, [
        updatedAudio.url,
        updatedAudio.thumbnailUrl
      ])
    }

    if (creatorIds && creatorIds.length > 0) {
      yield* Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            await tx.delete(audioCreators).where(eq(audioCreators.audioId, updatedAudio.id))

            await tx.insert(audioCreators).values(
              creatorIds.map((creatorId) => ({
                audioId: updatedAudio.id,
                creatorId
              }))
            )
          }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update creators: ${getErrorMessage(error)}`,
            operation: 'transaction',
            table: 'audio_creators'
          })
      })
    }

    const creatorRows = yield* Effect.tryPromise({
      try: () =>
        db.query.audioCreators.findMany({
          where: eq(audioCreators.audioId, updatedAudio.id),
          with: { creator: true }
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch creators: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio_creators'
        })
    })

    let compiledContent = ''
    if (updatedAudio.content) {
      compiledContent = yield* mdx
        .compile(updatedAudio.content)
        .pipe(Effect.orElseSucceed(() => ''))
    }

    let showThumbnailUrl: string | null = null
    const showId = updatedAudio.showId
    if (!updatedAudio.thumbnailUrl && showId) {
      const show = yield* Effect.tryPromise({
        try: () =>
          db.query.showsTable.findFirst({
            where: eq(showsTable.id, showId),
            columns: { thumbnailUrl: true }
          }),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch show: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'shows'
          })
      })
      showThumbnailUrl = show?.thumbnailUrl ?? null
    }

    return {
      ...updatedAudio,
      thumbnailUrl: updatedAudio.thumbnailUrl ?? showThumbnailUrl,
      compiledContent,
      creators: creatorRows.map(({ creator }) => ({
        id: creator.id,
        name: creator.name,
        username: creator.username
      }))
    }
  })

const PLAY_DEDUP_WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const playDedupMap = new Map<string, number>()

const trackPlayEffect = (id: string, clientIp?: string) =>
  Effect.gen(function* () {
    const records = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: audioTable.id, playCount: audioTable.playCount })
          .from(audioTable)
          .where(and(eq(audioTable.id, id), eq(audioTable.draft, false)))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch audio: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const audio = records[0]
    if (!audio) {
      return yield* new NotFoundError({
        message: 'Audio not found',
        resource: 'audio',
        id
      })
    }

    if (clientIp) {
      const now = Date.now()
      for (const [key, expiresAt] of playDedupMap) {
        if (now >= expiresAt) playDedupMap.delete(key)
      }

      const dedupKey = `${clientIp}:${id}`
      if (playDedupMap.has(dedupKey)) {
        return { playCount: audio.playCount }
      }
      playDedupMap.set(dedupKey, now + PLAY_DEDUP_WINDOW_MS)
    }

    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(audioTable)
          .set({ playCount: sql`${audioTable.playCount} + 1` })
          .where(eq(audioTable.id, audio.id))
          .returning({ playCount: audioTable.playCount }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to increment play count: ${getErrorMessage(error)}`,
          operation: 'update',
          table: 'audio'
        })
    })

    return { playCount: updated[0]?.playCount ?? 0 }
  })

export const AudioServiceLayer = Layer.effect(
  AudioService,
  Effect.gen(function* () {
    const mdx = yield* MdxService
    const crypto = yield* Crypto.Crypto
    const config = yield* ConfigService
    const uploadAssetService = yield* UploadAssetService
    return {
      getByType: (type, options) =>
        getByTypeEffect(type, options).pipe(
          Effect.withSpan('audio.getByType', { attributes: { type } })
        ),
      getByTypeForEdit: (type, options, userId, userRole) =>
        getByTypeEffect(type, options, { userId, userRole }).pipe(
          Effect.withSpan('audio.getByTypeForEdit', { attributes: { type } })
        ),
      getTags: (type) =>
        getTagsEffect(type).pipe(Effect.withSpan('audio.getTags', { attributes: { type } })),
      getBySlug: (type, slug) =>
        getBySlugEffect(type, slug, mdx).pipe(
          Effect.withSpan('audio.getBySlug', { attributes: { type, slug } })
        ),
      getBySlugForEdit: (type, slug, userId, userRole) =>
        Effect.gen(function* () {
          const audio = yield* getBySlugEffect(type, slug, mdx, true)
          yield* requireCreatorOrAdmin('audio', audio.id, userId, userRole)
          return audio
        }).pipe(Effect.withSpan('audio.getBySlugForEdit', { attributes: { type, slug } })),
      create: (data, creatorIds, options) =>
        createEffect(data, creatorIds, options).pipe(
          Effect.provideService(Crypto.Crypto, crypto),
          Effect.provideService(ConfigService, config),
          Effect.provideService(UploadAssetService, uploadAssetService),
          Effect.withSpan('audio.create')
        ),
      update: (type, slug, userId, userRole, data) =>
        updateEffect(type, slug, userId, userRole, data, mdx).pipe(
          Effect.provideService(ConfigService, config),
          Effect.provideService(UploadAssetService, uploadAssetService),
          Effect.withSpan('audio.update', { attributes: { type, slug } })
        ),
      trackPlay: (id, clientIp) =>
        trackPlayEffect(id, clientIp).pipe(
          Effect.withSpan('audio.trackPlay', { attributes: { id } })
        )
    }
  })
).pipe(Layer.provide(CryptoLive))
