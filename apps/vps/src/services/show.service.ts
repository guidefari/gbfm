import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { user as usersTable } from '@/db/auth.schema'
import {
  type InsertShow,
  type SelectMdxCompiledShow,
  type SelectShow,
  type SelectShowSubscription,
  showCreators,
  showsTable,
  showSubscriptionsTable
} from '@/db/show.schema'
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

type ShowWithHosts = SelectShow & {
  hosts: Array<{ id: string; name: string }>
}

type SubscriptionWithShow = SelectShowSubscription & {
  show: SelectShow
}

export interface ShowService {
  readonly getAll: (options: {
    limit: number
    offset: number
  }) => Effect.Effect<
    { data: ShowWithHosts[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledShow, DatabaseError | NotFoundError>
  readonly create: (
    data: InsertShow,
    hostIds: string[]
  ) => Effect.Effect<SelectShow, DatabaseError | ConflictError>
  readonly update: (
    slug: string,
    userId: string,
    userRole: string,
    data: Partial<InsertShow>
  ) => Effect.Effect<
    SelectMdxCompiledShow,
    DatabaseError | NotFoundError | UnauthorizedError
  >
  readonly delete: (
    slug: string,
    userId: string,
    userRole: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError | UnauthorizedError>
  readonly getEpisodes: (
    showSlug: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<
    { data: typeof audioTable.$inferSelect[]; pagination: PaginationMetadata },
    DatabaseError | NotFoundError
  >
  readonly subscribe: (
    userId: string,
    showId: string
  ) => Effect.Effect<SelectShowSubscription, DatabaseError | ConflictError>
  readonly unsubscribe: (
    userId: string,
    showId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly getUserSubscriptions: (
    userId: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<
    { data: SubscriptionWithShow[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly getSubscribers: (
    showId: string
  ) => Effect.Effect<
    Array<{ userId: string; email: string; name: string }>,
    DatabaseError
  >
}

export const ShowService = Context.GenericTag<ShowService>('ShowService')

const getAllEffect = (options: {
  limit: number
  offset: number
}) =>
  Effect.gen(function* () {
    const { limit, offset } = options

    const whereCondition = eq(showsTable.draft, false)

    const countResult = yield* Effect.tryPromise({
      try: () =>
        db.select({ total: count() }).from(showsTable).where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count shows: ${(error as Error).message}`,
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
          .orderBy(desc(showsTable.createdAt)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch shows: ${(error as Error).message}`,
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
                message: `Failed to fetch hosts: ${(error as Error).message}`,
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

const getBySlugEffect = (slug: string) =>
  Effect.gen(function* () {
    const showRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(showsTable)
          .where(eq(showsTable.slug, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch show: ${(error as Error).message}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const show = showRecords[0]
    if (!show) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Show not found',
          resource: 'show',
          id: slug
        })
      )
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
          message: `Failed to fetch hosts: ${(error as Error).message}`,
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
            message: `Failed to compile MDX: ${(error as Error).message}`,
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
          const [newShow] = await tx
            .insert(showsTable)
            .values(data)
            .returning()

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
        const errorMessage = (error as Error).message
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
  data: Partial<InsertShow>
) =>
  Effect.gen(function* () {
    const existingRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(showsTable)
          .where(eq(showsTable.slug, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check show existence: ${(error as Error).message}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const existingShow = existingRecords[0]
    if (!existingShow) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Show not found',
          resource: 'show',
          id: slug
        })
      )
    }

    const isAdmin = userRole === 'admin'
    if (!isAdmin) {
      const authorship = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(showCreators)
            .where(
              and(
                eq(showCreators.showId, existingShow.id),
                eq(showCreators.creatorId, userId)
              )
            )
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check authorship: ${(error as Error).message}`,
            operation: 'select',
            table: 'show_creators'
          })
      })

      if (authorship.length === 0) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: 'Forbidden, brethren.',
            userId
          })
        )
      }
    }

    const updatedRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .update(showsTable)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(showsTable.id, existingShow.id))
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to update show: ${(error as Error).message}`,
          operation: 'update',
          table: 'shows'
        })
    })

    const updatedShow = updatedRecords[0]
    if (!updatedShow) {
      return yield* Effect.fail(
        new DatabaseError({
          message: 'Failed to update show',
          operation: 'update',
          table: 'shows'
        })
      )
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
          message: `Failed to fetch hosts: ${(error as Error).message}`,
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
            message: `Failed to compile MDX: ${(error as Error).message}`,
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
      try: () =>
        db
          .select()
          .from(showsTable)
          .where(eq(showsTable.slug, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check show existence: ${(error as Error).message}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const existingShow = existingRecords[0]
    if (!existingShow) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Show not found',
          resource: 'show',
          id: slug
        })
      )
    }

    const isAdmin = userRole === 'admin'
    if (!isAdmin) {
      const authorship = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(showCreators)
            .where(
              and(
                eq(showCreators.showId, existingShow.id),
                eq(showCreators.creatorId, userId)
              )
            )
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check authorship: ${(error as Error).message}`,
            operation: 'select',
            table: 'show_creators'
          })
      })

      if (authorship.length === 0) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: 'Forbidden, brethren.',
            userId
          })
        )
      }
    }

    yield* Effect.tryPromise({
      try: () => db.delete(showsTable).where(eq(showsTable.id, existingShow.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to delete show: ${(error as Error).message}`,
          operation: 'delete',
          table: 'shows'
        })
    })
  })

const getEpisodesEffect = (
  showSlug: string,
  options: { limit: number; offset: number }
) =>
  Effect.gen(function* () {
    const { limit, offset } = options

    const showRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(showsTable)
          .where(eq(showsTable.slug, showSlug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch show: ${(error as Error).message}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const show = showRecords[0]
    if (!show) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Show not found',
          resource: 'show',
          id: showSlug
        })
      )
    }

    const whereCondition = and(
      eq(audioTable.showId, show.id),
      eq(audioTable.type, 'radio_show')
    )

    const countResult = yield* Effect.tryPromise({
      try: () =>
        db.select({ total: count() }).from(audioTable).where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count episodes: ${(error as Error).message}`,
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
          .orderBy(desc(audioTable.episodeNumber)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch episodes: ${(error as Error).message}`,
          operation: 'select',
          table: 'audio'
        })
    })

    return {
      data: episodes,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const subscribeEffect = (userId: string, showId: string) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(showSubscriptionsTable)
          .values({ userId, showId })
          .returning(),
      catch: (error) => {
        const errorMessage = (error as Error).message
        if (errorMessage.includes('unique constraint')) {
          return new ConflictError({
            message: 'Already subscribed to this show',
            resource: 'show_subscription'
          })
        }
        if (errorMessage.includes('foreign key constraint')) {
          return new ConflictError({
            message: 'Show not found',
            resource: 'show_subscription'
          })
        }
        return new DatabaseError({
          message: `Failed to subscribe: ${errorMessage}`,
          operation: 'insert',
          table: 'show_subscriptions'
        })
      }
    })

    const subscription = result[0]
    if (!subscription) {
      return yield* Effect.fail(
        new DatabaseError({
          message: 'Failed to create subscription',
          operation: 'insert',
          table: 'show_subscriptions'
        })
      )
    }

    return subscription
  })

const unsubscribeEffect = (userId: string, showId: string) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(showSubscriptionsTable)
          .where(
            and(
              eq(showSubscriptionsTable.userId, userId),
              eq(showSubscriptionsTable.showId, showId)
            )
          )
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to unsubscribe: ${(error as Error).message}`,
          operation: 'delete',
          table: 'show_subscriptions'
        })
    })

    if (result.length === 0) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Subscription not found',
          resource: 'show_subscription'
        })
      )
    }
  })

const getUserSubscriptionsEffect = (
  userId: string,
  options: { limit: number; offset: number }
) =>
  Effect.gen(function* () {
    const { limit, offset } = options

    const whereCondition = eq(showSubscriptionsTable.userId, userId)

    const countResult = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ total: count() })
          .from(showSubscriptionsTable)
          .where(whereCondition),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count subscriptions: ${(error as Error).message}`,
          operation: 'select',
          table: 'show_subscriptions'
        })
    })

    const total = countResult[0]?.total ?? 0

    const subscriptions = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: showSubscriptionsTable.id,
            userId: showSubscriptionsTable.userId,
            showId: showSubscriptionsTable.showId,
            createdAt: showSubscriptionsTable.createdAt,
            show: showsTable
          })
          .from(showSubscriptionsTable)
          .innerJoin(showsTable, eq(showSubscriptionsTable.showId, showsTable.id))
          .where(whereCondition)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(showSubscriptionsTable.createdAt)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch subscriptions: ${(error as Error).message}`,
          operation: 'select',
          table: 'show_subscriptions'
        })
    })

    return {
      data: subscriptions,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const getSubscribersEffect = (showId: string) =>
  Effect.gen(function* () {
    const subscribers = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            userId: usersTable.id,
            email: usersTable.email,
            name: usersTable.name
          })
          .from(showSubscriptionsTable)
          .innerJoin(usersTable, eq(showSubscriptionsTable.userId, usersTable.id))
          .where(eq(showSubscriptionsTable.showId, showId)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch subscribers: ${(error as Error).message}`,
          operation: 'select',
          table: 'show_subscriptions'
        })
    })

    return subscribers
  })

export const ShowServiceLive = Layer.succeed(ShowService, {
  getAll: getAllEffect,
  getBySlug: getBySlugEffect,
  create: createEffect,
  update: updateEffect,
  delete: deleteEffect,
  getEpisodes: getEpisodesEffect,
  subscribe: subscribeEffect,
  unsubscribe: unsubscribeEffect,
  getUserSubscriptions: getUserSubscriptionsEffect,
  getSubscribers: getSubscribersEffect
})
