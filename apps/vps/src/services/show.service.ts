import { and, asc, count, desc, eq, exists, inArray } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
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
    options: { limit: number; offset: number }
  ) => Effect.Effect<
    {
      data: (typeof audioTable.$inferSelect)[]
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
    const { limit, offset } = options
    const whereCondition = actor
      ? actor.userRole === 'admin'
        ? undefined
        : exists(
            db
              .select({ id: showCreators.showId })
              .from(showCreators)
              .where(
                and(
                  eq(showCreators.showId, showsTable.id),
                  eq(showCreators.creatorId, actor.userId)
                )
              )
          )
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
        db
          .select()
          .from(showsTable)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(showsTable.createdAt), asc(showsTable.title)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch shows: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const showIds = shows.map((s) => s.id)

    const hostsData =
      showIds.length > 0
        ? yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  showId: showCreators.showId,
                  hostId: usersTable.id,
                  hostName: usersTable.name
                })
                .from(showCreators)
                .innerJoin(usersTable, eq(showCreators.creatorId, usersTable.id))
                .where(inArray(showCreators.showId, showIds)),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to fetch hosts: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'show_creators'
              })
          })
        : []

    const hostsByShowId: Record<string, Array<{ id: string; name: string }>> = {}
    for (const row of hostsData) {
      const existing = hostsByShowId[row.showId]
      if (existing) {
        existing.push({ id: row.hostId, name: row.hostName })
      } else {
        hostsByShowId[row.showId] = [{ id: row.hostId, name: row.hostName }]
      }
    }

    const data = shows.map((show) => ({
      ...show,
      hosts: hostsByShowId[show.id] || []
    }))

    return {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const getBySlugEffect = (slug: string, includeDrafts = false) =>
  Effect.gen(function* () {
    const showRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(showsTable)
          .where(
            includeDrafts
              ? eq(showsTable.slug, slug)
              : and(eq(showsTable.slug, slug), eq(showsTable.draft, false))
          )
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
        id: slug
      })
    }

    const hosts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name
          })
          .from(showCreators)
          .innerJoin(usersTable, eq(showCreators.creatorId, usersTable.id))
          .where(eq(showCreators.showId, show.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch hosts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'show_creators'
        })
    })

    let processedShow: SelectMdxCompiledShow = {
      ...show,
      compiledContent: '',
      hosts: hosts.map((host) => ({
        id: host.id,
        name: host.name
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
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const [newShow] = await tx.insert(showsTable).values(data).returning()

          if (!newShow) {
            throw new Error('Failed to create show')
          }

          if (hostIds.length > 0) {
            await tx.insert(showCreators).values(
              hostIds.map((creatorId) => ({
                showId: newShow.id,
                creatorId
              }))
            )
          }

          return newShow
        }),
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

    return result
  })

const updateEffect = (
  slug: string,
  userId: string,
  userRole: string,
  data: Partial<InsertShow> & { hostIds?: string[] }
) =>
  Effect.gen(function* () {
    const { hostIds, ...updateData } = data

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
      try: () =>
        db.transaction(async (tx) => {
          const [updatedShow] = await tx
            .update(showsTable)
            .set({ ...updateData, updatedAt: new Date() })
            .where(eq(showsTable.id, existingShow.id))
            .returning()

          if (!updatedShow) {
            throw new Error('Failed to update show')
          }

          if (hostIds) {
            await tx.delete(showCreators).where(eq(showCreators.showId, updatedShow.id))

            if (hostIds.length > 0) {
              await tx.insert(showCreators).values(
                hostIds.map((creatorId) => ({
                  showId: updatedShow.id,
                  creatorId
                }))
              )
            }
          }
          return [updatedShow]
        }),
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

    const hosts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name
          })
          .from(showCreators)
          .innerJoin(usersTable, eq(showCreators.creatorId, usersTable.id))
          .where(eq(showCreators.showId, updatedShow.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch hosts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'show_creators'
        })
    })

    const baseProcessedShow: SelectMdxCompiledShow = {
      ...updatedShow,
      compiledContent: '',
      hosts: hosts.map((host) => ({
        id: host.id,
        name: host.name
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
      try: () => db.delete(showsTable).where(eq(showsTable.id, existingShow.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete show: ${getErrorMessage(error)}`,
          operation: 'delete',
          table: 'shows'
        })
    })
  })

const getEpisodesEffect = (showSlug: string, options: { limit: number; offset: number }) =>
  Effect.gen(function* () {
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

    const whereCondition = and(eq(audioTable.showId, show.id), eq(audioTable.draft, false))

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
        db
          .select()
          .from(audioTable)
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(audioTable.createdAt)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch episodes: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    })

    return {
      data: episodes,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

export const ShowServiceLayer = Layer.succeed(ShowService, {
  getAll: (options) => getAllEffect(options).pipe(Effect.withSpan('show.getAll')),
  getAllForEdit: (options, userId, userRole) =>
    getAllEffect(options, { userId, userRole }).pipe(Effect.withSpan('show.getAllForEdit')),
  getBySlug: (slug) =>
    getBySlugEffect(slug).pipe(Effect.withSpan('show.getBySlug', { attributes: { slug } })),
  getBySlugForEdit: (slug, userId, userRole) =>
    Effect.gen(function* () {
      const show = yield* getBySlugEffect(slug, true)
      yield* requireCreatorOrAdmin('show', show.id, userId, userRole)
      return show
    }).pipe(Effect.withSpan('show.getBySlugForEdit', { attributes: { slug } })),
  create: (data, hostIds) => createEffect(data, hostIds).pipe(Effect.withSpan('show.create')),
  update: (slug, userId, userRole, data) =>
    updateEffect(slug, userId, userRole, data).pipe(
      Effect.withSpan('show.update', { attributes: { slug } })
    ),
  delete: (slug, userId, userRole) =>
    deleteEffect(slug, userId, userRole).pipe(
      Effect.withSpan('show.delete', { attributes: { slug } })
    ),
  getEpisodes: (showSlug, options) =>
    getEpisodesEffect(showSlug, options).pipe(
      Effect.withSpan('show.getEpisodes', { attributes: { showSlug } })
    )
})
