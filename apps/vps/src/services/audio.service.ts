import { and, arrayContains, count, desc, eq, inArray, sql } from 'drizzle-orm'
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
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import {
  createPaginationMetadata,
  type PaginationMetadata
} from '@/lib/pagination'
import { recordAudioCreate } from '@/lib/performance-monitoring'

type AudioType = 'mix' | 'track' | 'misc'

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
  ) => Effect.Effect<
    { data: AudioWithCreators[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly getBySlug: (
    type: AudioType,
    slug: string
  ) => Effect.Effect<SelectMdxCompiledAudio, DatabaseError | NotFoundError>
  readonly create: (
    data: InsertAudio,
    creatorIds: string[]
  ) => Effect.Effect<SelectAudio, DatabaseError | ConflictError>
  readonly update: (
    type: AudioType,
    slug: string,
    userId: string,
    userRole: string,
    data: Partial<InsertAudio> & { creatorIds?: string[] }
  ) => Effect.Effect<
    SelectMdxCompiledAudio,
    DatabaseError | NotFoundError | UnauthorizedError
  >
  readonly trackPlay: (
    id: string
  ) => Effect.Effect<{ playCount: number }, DatabaseError | NotFoundError>
}

export const AudioService = Context.GenericTag<AudioService>('AudioService')

const getByTypeEffect = (
  type: AudioType,
  options: { limit: number; offset: number; tag?: string }
) =>
  Effect.gen(function* () {
    const { limit, offset, tag } = options
    yield* Effect.annotateCurrentSpan('audio.type', type)
    yield* Effect.annotateCurrentSpan('audio.limit', limit)
    yield* Effect.annotateCurrentSpan('audio.offset', offset)
    if (tag) yield* Effect.annotateCurrentSpan('audio.tag', tag)
    const whereCondition = tag
      ? and(eq(audioTable.type, type), arrayContains(audioTable.tags, [tag]))
      : eq(audioTable.type, type)

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db
              .select({ total: count() })
              .from(audioTable)
              .where(whereCondition),
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
                .innerJoin(
                  usersTable,
                  eq(audioCreators.creatorId, usersTable.id)
                )
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

const getBySlugEffect = (type: AudioType, slug: string) =>
  Effect.gen(function* () {
    const audioRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(audioTable)
          .where(and(eq(audioTable.type, type), eq(audioTable.slug, slug)))
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

    let processedAudio: SelectMdxCompiledAudio = {
      ...audio,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name,
        username: creator.username
      }))
    }

    if (audio.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(audio.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'audio'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        processedAudio = {
          ...processedAudio,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return processedAudio
  })

const createEffect = (data: InsertAudio, creatorIds: string[]) =>
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
              const [newAudio] = await tx
                .insert(audioTable)
                .values(audioData)
                .returning()

              if (!newAudio) {
                throw new Error('Failed to create audio')
              }

              await tx.insert(audioCreators).values(
                creatorIds.map((creatorId) => ({
                  audioId: newAudio.id,
                  creatorId
                }))
              )

              return newAudio
            }),
          'create-audio-transaction'
        ),
      catch: (error) => {
        const errorMessage = getErrorMessage(error)
        if (errorMessage.includes('unique constraint')) {
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

    yield* Effect.annotateCurrentSpan('audioId', result.id)
    yield* Effect.annotateCurrentSpan('audioType', result.type)
    yield* Effect.annotateCurrentSpan('creatorCount', creatorIds.length)

    yield* recordAudioCreate()

    yield* Effect.logInfo('[Content] Audio created', {
      audioId: result.id,
      type: result.type,
      title: result.title,
      slug: result.slug,
      creatorCount: creatorIds.length
    })

    return result
  })

const updateEffect = (
  type: AudioType,
  slug: string,
  userId: string,
  userRole: string,
  data: Partial<InsertAudio> & { creatorIds?: string[] }
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
            await tx
              .delete(audioCreators)
              .where(eq(audioCreators.audioId, updatedAudio.id))

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

    const baseProcessedAudio: SelectMdxCompiledAudio = {
      ...updatedAudio,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name,
        username: creator.username
      }))
    }

    if (updatedAudio.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(updatedAudio.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'audio'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        return {
          ...baseProcessedAudio,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return baseProcessedAudio
  })

const trackPlayEffect = (id: string) =>
  Effect.gen(function* () {
    const records = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: audioTable.id })
          .from(audioTable)
          .where(eq(audioTable.id, id))
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

export const AudioServiceLive = Layer.succeed(AudioService, {
  getByType: (type, options) =>
    getByTypeEffect(type, options).pipe(
      Effect.withSpan('audio.getByType', { attributes: { type } })
    ),
  getBySlug: (type, slug) =>
    getBySlugEffect(type, slug).pipe(
      Effect.withSpan('audio.getBySlug', { attributes: { type, slug } })
    ),
  create: (data, creatorIds) =>
    createEffect(data, creatorIds).pipe(Effect.withSpan('audio.create')),
  update: (type, slug, userId, userRole, data) =>
    updateEffect(type, slug, userId, userRole, data).pipe(
      Effect.withSpan('audio.update', { attributes: { type, slug } })
    ),
  trackPlay: (id) =>
    trackPlayEffect(id).pipe(
      Effect.withSpan('audio.trackPlay', { attributes: { id } })
    )
})
