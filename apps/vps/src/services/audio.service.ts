import { and, arrayContains, count, desc, eq, inArray } from 'drizzle-orm'
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
import {
  ConflictError,
  DatabaseError,
  NotFoundError,
  UnauthorizedError
} from '@/errors'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import {
  createPaginationMetadata,
  type PaginationMetadata
} from '@/lib/pagination'

type AudioType = 'mix' | 'track' | 'misc' | 'radio_show'

type AudioWithCreators = SelectAudio & {
  creators: Array<{ id: string; name: string }>
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
    data: Partial<InsertAudio>
  ) => Effect.Effect<
    SelectMdxCompiledAudio,
    DatabaseError | NotFoundError | UnauthorizedError
  >
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
          message: `Failed to fetch audio: ${(error as Error).message}`,
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
                  creatorName: usersTable.name
                })
                .from(audioCreators)
                .innerJoin(
                  usersTable,
                  eq(audioCreators.creatorId, usersTable.id)
                )
                .where(inArray(audioCreators.audioId, audioIds)),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to fetch creators: ${(error as Error).message}`,
                operation: 'select',
                table: 'audio_creators'
              })
          })
        : []

    const creatorsByAudioId: Record<
      string,
      Array<{ id: string; name: string }>
    > = {}
    for (const row of creatorsData) {
      const existing = creatorsByAudioId[row.audioId]
      if (existing) {
        existing.push({ id: row.creatorId, name: row.creatorName })
      } else {
        creatorsByAudioId[row.audioId] = [
          { id: row.creatorId, name: row.creatorName }
        ]
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
          message: `Failed to fetch audio: ${(error as Error).message}`,
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
            name: usersTable.name
          })
          .from(audioCreators)
          .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
          .where(eq(audioCreators.audioId, audio.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch creators: ${(error as Error).message}`,
          operation: 'select',
          table: 'audio_creators'
        })
    })

    let processedAudio: SelectMdxCompiledAudio = {
      ...audio,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (audio.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(audio.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${(error as Error).message}`,
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
    const result = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db.transaction(async (tx) => {
              const [newAudio] = await tx
                .insert(audioTable)
                .values(data)
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
        const errorMessage = (error as Error).message
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
  data: Partial<InsertAudio>
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
          message: `Failed to check audio existence: ${(error as Error).message}`,
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

    const isAdmin = userRole === 'admin'
    if (!isAdmin) {
      const authorship = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(audioCreators)
            .where(
              and(
                eq(audioCreators.audioId, existingAudio.id),
                eq(audioCreators.creatorId, userId)
              )
            )
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check authorship: ${(error as Error).message}`,
            operation: 'select',
            table: 'audio_creators'
          })
      })

      if (authorship.length === 0) {
        return yield* new UnauthorizedError({
          message: 'Forbidden, brethren.',
          userId
        })
      }
    }

    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(audioTable)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(audioTable.id, existingAudio.id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update audio: ${(error as Error).message}`,
          operation: 'update',
          table: 'audio'
        })
    })

    const updatedAudio = updatedRecords[0]
    if (!updatedAudio) {
      return yield* new DatabaseError({
        message: 'Failed to update audio',
        operation: 'update',
        table: 'audio'
      })
    }

    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name
          })
          .from(audioCreators)
          .innerJoin(usersTable, eq(audioCreators.creatorId, usersTable.id))
          .where(eq(audioCreators.audioId, updatedAudio.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch creators: ${(error as Error).message}`,
          operation: 'select',
          table: 'audio_creators'
        })
    })

    const baseProcessedAudio: SelectMdxCompiledAudio = {
      ...updatedAudio,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (updatedAudio.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(updatedAudio.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${(error as Error).message}`,
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

export const AudioServiceLive = Layer.succeed(AudioService, {
  getByType: getByTypeEffect,
  getBySlug: getBySlugEffect,
  create: createEffect,
  update: updateEffect
})
