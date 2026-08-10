import { and, asc, count, desc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { Database } from '@/db/layer'
import { projectEntityLabels, projectEntityLabelsForRows, replaceEntityLabels } from '@/db/labels'
import { entityLabelsTable } from '@/db/tags.schema'
import { audioTable, type SelectAudio } from '@/db/audio.schema'
import { showIdsForCreator } from '@/db/creator-membership'
import {
  type InsertShow,
  type SelectMdxCompiledShow,
  type SelectShow,
  showCreators,
  showsTable
} from '@/db/show.schema'
import {
  ConflictError,
  DatabaseError,
  getErrorMessage,
  NotFoundError,
  type UnauthorizedError
} from '@/errors'
import { requireCreatorOrAdmin } from '@/lib/authorization'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'

export { ShowSubscriptionService, ShowSubscriptionServiceLayer } from './show-subscription.service'

type ShowWithHosts = SelectShow & {
  hosts: Array<{ id: string; name: string }>
}

export interface ShowService {
  readonly getAll: (options: {
    limit: number
    offset: number
  }) => Effect.Effect<{ data: ShowWithHosts[]; pagination: PaginationMetadata }, DatabaseError>
  readonly getAllForEdit: (
    options: { limit: number; offset: number },
    userId: string,
    userRole: string
  ) => Effect.Effect<{ data: ShowWithHosts[]; pagination: PaginationMetadata }, DatabaseError>
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledShow, DatabaseError | NotFoundError>
  readonly getBySlugForEdit: (
    slug: string,
    userId: string,
    userRole: string
  ) => Effect.Effect<SelectMdxCompiledShow, DatabaseError | NotFoundError | UnauthorizedError>
  readonly create: (
    data: InsertShow,
    hostIds: string[]
  ) => Effect.Effect<SelectShow, DatabaseError | ConflictError>
  readonly update: (
    slug: string,
    userId: string,
    userRole: string,
    data: Partial<InsertShow> & { hostIds?: string[] }
  ) => Effect.Effect<SelectMdxCompiledShow, DatabaseError | NotFoundError | UnauthorizedError>
  readonly delete: (
    slug: string,
    userId: string,
    userRole: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError | UnauthorizedError>
  readonly getEpisodes: (
    showSlug: string,
    options: { limit: number; offset: number },
    actor?: { userId: string; userRole: string }
  ) => Effect.Effect<
    {
      data: SelectAudio[]
      pagination: PaginationMetadata
    },
    DatabaseError | NotFoundError
  >
}

export const ShowService = Context.Service<ShowService>('ShowService')

const getAllEffect = (
  options: { limit: number; offset: number },
  actor?: { userId: string; userRole: string }
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const { limit, offset } = options
    const whereCondition = actor
      ? actor.userRole === 'admin'
        ? undefined
        : showIdsForCreator(db, actor.userId)
      : eq(showsTable.draft, false)

    const countResult = yield* Effect.tryPromise({
      try: () => db.select({ total: count() }).from(showsTable).where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count shows: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const total = countResult[0]?.total ?? 0

    const shows = yield* Effect.tryPromise({
      try: () =>
        db.query.showsTable.findMany({
          where: whereCondition,
          limit,
          offset,
          orderBy: [desc(showsTable.createdAt), asc(showsTable.title)],
          with: {
            showCreators: {
              with: { creator: true }
            }
          }
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch shows: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const projectedShows = yield* Effect.tryPromise({
      try: () => projectEntityLabelsForRows(db, 'show', shows),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
    const data = projectedShows.map(({ showCreators: hosts, ...show }) => ({
      ...show,
      hosts: hosts.map(({ creator }) => ({ id: creator.id, name: creator.name }))
    }))

    return {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const getBySlugEffect = (slug: string, includeDrafts = false) =>
  Effect.gen(function* () {
    const db = yield* Database
    const show = yield* Effect.tryPromise({
      try: () =>
        db.query.showsTable.findFirst({
          where: includeDrafts
            ? eq(showsTable.slug, slug)
            : and(eq(showsTable.slug, slug), eq(showsTable.draft, false)),
          with: {
            showCreators: {
              with: { creator: true }
            }
          }
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch show: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    })

    if (!show) {
      return yield* new NotFoundError({
        message: 'Show not found',
        resource: 'show',
        id: slug
      })
    }

    const { showCreators: hosts, ...showFields } = show
    const { tags } = yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'show', showFields),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })

    let processedShow: SelectMdxCompiledShow = {
      ...showFields,
      tags,
      compiledContent: '',
      hosts: hosts.map(({ creator }) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (show.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(show.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'shows'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        processedShow = {
          ...processedShow,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return processedShow
  })

const createEffect = (data: InsertShow, hostIds: string[]) =>
  Effect.gen(function* () {
    const db = yield* Database
    const { tags, ...showData } = data
    const id = crypto.randomUUID()
    const result = yield* Effect.tryPromise({
      try: async () => {
        await db.batch([
          db.insert(showsTable).values({ ...showData, id }),
          ...(hostIds.length > 0
            ? [
                db
                  .insert(showCreators)
                  .values(hostIds.map((creatorId) => ({ showId: id, creatorId })))
              ]
            : [])
        ])
        const rows = await db.select().from(showsTable).where(eq(showsTable.id, id)).limit(1)
        const show = rows[0]
        if (!show) throw new Error('Failed to create show')
        if (tags !== undefined) await replaceEntityLabels(db, 'show', show.id, { tags })
        return show
      },
      catch: (error) => {
        const errorMessage = getErrorMessage(error)
        if (errorMessage.includes('unique constraint')) {
          return new ConflictError({
            message: 'Show with this slug already exists',
            resource: 'show'
          })
        }
        if (errorMessage.includes('foreign key constraint')) {
          return new ConflictError({
            message: 'You may have entered a non-existent host id',
            resource: 'show'
          })
        }
        return new DatabaseError({
          message: `Failed to create show: ${errorMessage}`,
          operation: 'transaction',
          table: 'shows'
        })
      }
    })

    const { tags: projectedTags } = yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'show', result),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
    return { ...result, tags: projectedTags }
  })

const updateEffect = (
  slug: string,
  userId: string,
  userRole: string,
  data: Partial<InsertShow> & { hostIds?: string[] }
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const { hostIds, tags, ...updateData } = data

    const existingRecords = yield* Effect.tryPromise({
      try: () => db.select().from(showsTable).where(eq(showsTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check show existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const existingShow = existingRecords[0]
    if (!existingShow) {
      return yield* new NotFoundError({
        message: 'Show not found',
        resource: 'show',
        id: slug
      })
    }

    yield* requireCreatorOrAdmin('show', existingShow.id, userId, userRole)

    const updatedRecords = yield* Effect.tryPromise({
      try: async () => {
        const update = db
          .update(showsTable)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(showsTable.id, existingShow.id))

        if (hostIds) {
          await db.batch([
            update,
            db.delete(showCreators).where(eq(showCreators.showId, existingShow.id)),
            ...(hostIds.length > 0
              ? [
                  db
                    .insert(showCreators)
                    .values(hostIds.map((creatorId) => ({ showId: existingShow.id, creatorId })))
                ]
              : [])
          ])
        } else {
          await db.batch([update])
        }

        return db.select().from(showsTable).where(eq(showsTable.id, existingShow.id)).limit(1)
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update show: ${getErrorMessage(error)}`,
          operation: 'update',
          table: 'shows'
        })
    })

    const updatedShow = updatedRecords[0]
    if (!updatedShow) {
      return yield* new DatabaseError({
        message: 'Failed to update show',
        operation: 'update',
        table: 'shows'
      })
    }

    if (tags !== undefined) {
      yield* Effect.tryPromise({
        try: () => replaceEntityLabels(db, 'show', updatedShow.id, { tags }),
        catch: (error) =>
          new DatabaseError({
            message: getErrorMessage(error),
            operation: 'update',
            table: 'labels'
          })
      })
    }

    const hostRows = yield* Effect.tryPromise({
      try: () =>
        db.query.showCreators.findMany({
          where: eq(showCreators.showId, updatedShow.id),
          with: { creator: true }
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch hosts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'show_creators'
        })
    })

    const { tags: projectedTags } = yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'show', updatedShow),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
    const baseProcessedShow: SelectMdxCompiledShow = {
      ...updatedShow,
      tags: projectedTags,
      compiledContent: '',
      hosts: hostRows.map(({ creator }) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (updatedShow.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(updatedShow.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'shows'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        return {
          ...baseProcessedShow,
          compiledContent: mdxResult.compiled
        }
      }
    }

    return baseProcessedShow
  })

const deleteEffect = (slug: string, userId: string, userRole: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const existingRecords = yield* Effect.tryPromise({
      try: () => db.select().from(showsTable).where(eq(showsTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check show existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const existingShow = existingRecords[0]
    if (!existingShow) {
      return yield* new NotFoundError({
        message: 'Show not found',
        resource: 'show',
        id: slug
      })
    }

    yield* requireCreatorOrAdmin('show', existingShow.id, userId, userRole)

    yield* Effect.tryPromise({
      try: () =>
        db.batch([
          db
            .delete(entityLabelsTable)
            .where(
              and(
                eq(entityLabelsTable.entityType, 'show'),
                eq(entityLabelsTable.entityId, existingShow.id)
              )
            ),
          db.delete(showsTable).where(eq(showsTable.id, existingShow.id))
        ]),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete show: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'shows'
        })
    })
  })

const getEpisodesEffect = (
  showSlug: string,
  options: { limit: number; offset: number },
  actor?: { userId: string; userRole: string }
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const { limit, offset } = options

    const showRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(showsTable)
          .where(and(eq(showsTable.slug, showSlug), eq(showsTable.draft, false)))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch show: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const show = showRecords[0]
    if (!show) {
      return yield* new NotFoundError({
        message: 'Show not found',
        resource: 'show',
        id: showSlug
      })
    }

    const draftCondition = actor?.userRole === 'admin' ? undefined : eq(audioTable.draft, false)
    const whereCondition = and(eq(audioTable.showId, show.id), draftCondition)

    const countResult = yield* Effect.tryPromise({
      try: () => db.select({ total: count() }).from(audioTable).where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count episodes: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const total = countResult[0]?.total ?? 0

    const episodes = yield* Effect.tryPromise({
      try: () =>
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
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch episodes: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    const projectedEpisodes = yield* Effect.tryPromise({
      try: () => projectEntityLabelsForRows(db, 'audio', episodes),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
    const data = projectedEpisodes.map(
      ({ audioCreators: creators, show: episodeShow, ...episode }) => ({
        ...episode,
        thumbnailUrl: episode.thumbnailUrl ?? episodeShow?.thumbnailUrl ?? null,
        creators: creators.map(({ creator }) => ({
          id: creator.id,
          name: creator.name,
          username: creator.username
        }))
      })
    )

    return {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

export const ShowServiceLayer = Layer.effect(
  ShowService,
  Effect.gen(function* () {
    const db = yield* Database
    const provideDb = Effect.provideService(Database, db)
    return {
      getAll: (options) => provideDb(getAllEffect(options)).pipe(Effect.withSpan('show.getAll')),
      getAllForEdit: (options, userId, userRole) =>
        provideDb(getAllEffect(options, { userId, userRole })).pipe(
          Effect.withSpan('show.getAllForEdit')
        ),
      getBySlug: (slug) =>
        provideDb(getBySlugEffect(slug)).pipe(
          Effect.withSpan('show.getBySlug', { attributes: { slug } })
        ),
      getBySlugForEdit: (slug, userId, userRole) =>
        provideDb(
          Effect.gen(function* () {
            const show = yield* getBySlugEffect(slug, true)
            yield* requireCreatorOrAdmin('show', show.id, userId, userRole)
            return show
          })
        ).pipe(Effect.withSpan('show.getBySlugForEdit', { attributes: { slug } })),
      create: (data, hostIds) =>
        provideDb(createEffect(data, hostIds)).pipe(Effect.withSpan('show.create')),
      update: (slug, userId, userRole, data) =>
        provideDb(updateEffect(slug, userId, userRole, data)).pipe(
          Effect.withSpan('show.update', { attributes: { slug } })
        ),
      delete: (slug, userId, userRole) =>
        provideDb(deleteEffect(slug, userId, userRole)).pipe(
          Effect.withSpan('show.delete', { attributes: { slug } })
        ),
      getEpisodes: (showSlug, options, actor) =>
        provideDb(getEpisodesEffect(showSlug, options, actor)).pipe(
          Effect.withSpan('show.getEpisodes', { attributes: { showSlug } })
        )
    }
  })
)
