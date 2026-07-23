import { and, arrayContains, count, desc, eq, exists, inArray, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import {
  audioCreators,
  audioTable,
  type InsertAudio,
  type SelectAudio,
  type SelectMdxCompiledAudio
} from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
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
import { MdxService } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'
import { recordAudioCreate } from '@/lib/performance-monitoring'

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
            db
              .select()
              .from(audioTable)
              .where(whereCondition)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(audioTable.createdAt)),
          'get-audio-by-type-data'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch audio: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const audioIds = audioItems.map((a) => a.id)

    const creatorsData =
      audioIds.length > 0
        ? yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  audioId: audioCreators.audioId,
                  creatorId: usersTable.id,
                  creatorName: usersTable.name,
                  creatorUsername: usersTable.username
                })
                .from(audioCreators)
                .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
                .where(inArray(audioCreators.audioId, audioIds)),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to fetch creators: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'audio_creators'
              })
          })
        : []

    const creatorsByAudioId: Record<
      string,
      Array<{
        id: string
        name: string
        username: string | null
      }>
    > = {}
    for (const row of creatorsData) {
      const existing = creatorsByAudioId[row.audioId]
      const creatorInfo = {
        id: row.creatorId,
        name: row.creatorName,
        username: row.creatorUsername
      }
      if (existing) {
        existing.push(creatorInfo)
      } else {
        creatorsByAudioId[row.audioId] = [creatorInfo]
      }
    }

    const data = audioItems.map((audio) => ({
      ...audio,
      creators: creatorsByAudioId[audio.id] || []
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
    const audioRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(audioTable)
          .where(
            includeDrafts
              ? and(eq(audioTable.type, type), eq(audioTable.slug, slug))
              : and(
                  eq(audioTable.type, type),
                  eq(audioTable.slug, slug),
                  eq(audioTable.draft, false)
                )
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch audio: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const audio = audioRecords[0]
    if (!audio) {
      return yield* new NotFoundError({
        message: 'Audio not found',
        resource: 'audio',
        id: slug
      })
    }

    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            username: usersTable.username
          })
          .from(audioCreators)
          .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
          .where(eq(audioCreators.audioId, audio.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch creators: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio_creators'
        })
    })

    let compiledContent = ''
    if (audio.content) {
      compiledContent = yield* mdx.compile(audio.content).pipe(Effect.orElseSucceed(() => ''))
    }

    return {
      ...audio,
      compiledContent,
      creators: creators.map((creator) => ({
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
    let audioData = { ...data }

    if (data.showId && !data.thumbnailUrl) {
      const showId = data.showId
      const showResult = yield* Effect.tryPromise({
        try: () =>
          db
            .select({ thumbnailUrl: showsTable.thumbnailUrl })
            .from(showsTable)
            .where(eq(showsTable.id, showId))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch show: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'shows'
          })
      })

      if (showResult[0]?.thumbnailUrl) {
        audioData = { ...audioData, thumbnailUrl: showResult[0].thumbnailUrl }
      }
    }

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
                  idempotencyActorId: actorId
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

    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            username: usersTable.username
          })
          .from(audioCreators)
          .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
          .where(eq(audioCreators.audioId, updatedAudio.id)),
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

    return {
      ...updatedAudio,
      compiledContent,
      creators: creators.map((creator) => ({
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

export const AudioServiceLive = Layer.effect(
  AudioService,
  Effect.gen(function* () {
    const mdx = yield* MdxService
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
        createEffect(data, creatorIds, options).pipe(Effect.withSpan('audio.create')),
      update: (type, slug, userId, userRole, data) =>
        updateEffect(type, slug, userId, userRole, data, mdx).pipe(
          Effect.withSpan('audio.update', { attributes: { type, slug } })
        ),
      trackPlay: (id, clientIp) =>
        trackPlayEffect(id, clientIp).pipe(
          Effect.withSpan('audio.trackPlay', { attributes: { id } })
        )
    }
  })
)
