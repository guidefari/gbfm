import { and, desc, eq, isNotNull, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { favoritesTable, type SelectFavorite } from '@/db/favorites.schema'
import { showSubscriptionsTable, showsTable } from '@/db/show.schema'
import { ConflictError, DatabaseError, getErrorMessage, NotFoundError } from '@/errors'
import { recordFavoriteAdd, recordFavoriteRemove } from '@/lib/performance-monitoring'

const audioShowsTable = alias(showsTable, 'audio_shows')

type FavoriteWithContent = {
  id: string
  userId: string
  audioId: string | null
  showId: string | null
  createdAt: Date
  audio: {
    id: string
    title: string
    slug: string
    thumbnailUrl: string | null
    type: 'mix' | 'track' | 'misc'
    url: string
  } | null
  show: {
    id: string
    title: string
    slug: string
    thumbnailUrl: string | null
  } | null
}

// Service interface
export interface FavoriteService {
  readonly addFavorite: (
    userId: string,
    audioId: string
  ) => Effect.Effect<SelectFavorite, DatabaseError | NotFoundError | ConflictError>
  readonly addShowFavorite: (
    userId: string,
    showId: string
  ) => Effect.Effect<SelectFavorite, DatabaseError | NotFoundError | ConflictError>
  readonly removeFavorite: (
    userId: string,
    audioId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly removeShowFavorite: (
    userId: string,
    showId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly getFavorites: (
    userId: string,
    limit?: number,
    offset?: number
  ) => Effect.Effect<FavoriteWithContent[], DatabaseError>
}

// Service tag for dependency injection
export const FavoriteService = Context.Service<FavoriteService>('FavoriteService')

// Core service logic - pure Effects with no service dependencies
const addFavoriteEffect = (userId: string, audioId: string) =>
  Effect.withSpan('favorite.add', {
    attributes: { userId, audioId }
  })(
    Effect.gen(function* () {
      // Check if audio exists
      const audioRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(audioTable)
            .where(and(eq(audioTable.id, audioId), eq(audioTable.draft, false)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check audio existence: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'audio'
          })
      })

      if (audioRecords.length === 0) {
        return yield* new NotFoundError({
          message: 'Audio not found',
          resource: 'audio',
          id: audioId
        })
      }

      // Check if already favorited
      const existingRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(favoritesTable)
            .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.audioId, audioId)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check existing favorite: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'favorites'
          })
      })

      if (existingRecords.length > 0) {
        return yield* new ConflictError({
          message: 'Already favorited',
          resource: 'favorite',
          id: `${userId}-${audioId}`
        })
      }

      // Add favorite
      const insertedRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(favoritesTable)
            .values({
              userId,
              audioId
            })
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to add favorite: ${getErrorMessage(error)}`,
            operation: 'insert',
            table: 'favorites'
          })
      })

      if (insertedRecords.length === 0) {
        return yield* new DatabaseError({
          message: 'Failed to create favorite record',
          operation: 'insert',
          table: 'favorites'
        })
      }

      const favorite = insertedRecords[0]
      if (!favorite) {
        return yield* new DatabaseError({
          message: 'Failed to create favorite record',
          operation: 'insert',
          table: 'favorites'
        })
      }

      yield* Effect.logInfo('[Favorites] Favorite added', {
        userId,
        audioId,
        favoriteId: favorite.id
      })

      yield* recordFavoriteAdd()

      return favorite
    })
  )

const removeFavoriteEffect = (userId: string, audioId: string) =>
  Effect.withSpan('favorite.remove', {
    attributes: { userId, audioId }
  })(
    Effect.gen(function* () {
      // Check if favorite exists
      const existingRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(favoritesTable)
            .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.audioId, audioId)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check favorite existence: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'favorites'
          })
      })

      if (existingRecords.length === 0) {
        return yield* new NotFoundError({
          message: 'Favorite not found',
          resource: 'favorite',
          id: `${userId}-${audioId}`
        })
      }

      // Remove favorite
      yield* Effect.tryPromise({
        try: () =>
          db
            .delete(favoritesTable)
            .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.audioId, audioId))),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to remove favorite: ${getErrorMessage(error)}`,
            operation: 'delete',
            table: 'favorites'
          })
      })

      yield* recordFavoriteRemove()

      yield* Effect.logInfo('[Favorites] Favorite removed', {
        userId,
        audioId
      })
    })
  )

const addShowFavoriteEffect = (userId: string, showId: string) =>
  Effect.withSpan('favorite.addShow', {
    attributes: { userId, showId }
  })(
    Effect.gen(function* () {
      const showRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(showsTable)
            .where(and(eq(showsTable.id, showId), eq(showsTable.draft, false)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check show existence: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'shows'
          })
      })

      if (showRecords.length === 0) {
        return yield* new NotFoundError({
          message: 'Show not found',
          resource: 'show',
          id: showId
        })
      }

      const existingRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(favoritesTable)
            .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.showId, showId)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check existing favorite: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'favorites'
          })
      })

      if (existingRecords.length > 0) {
        return yield* new ConflictError({
          message: 'Already favorited',
          resource: 'favorite',
          id: `${userId}-${showId}`
        })
      }

      const insertedRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(favoritesTable)
            .values({
              userId,
              showId
            })
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to add favorite: ${getErrorMessage(error)}`,
            operation: 'insert',
            table: 'favorites'
          })
      })

      const favorite = insertedRecords[0]
      if (!favorite) {
        return yield* new DatabaseError({
          message: 'Failed to create favorite record',
          operation: 'insert',
          table: 'favorites'
        })
      }

      // Auto-subscribe when favoriting a show
      const existingSubscription = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(showSubscriptionsTable)
            .where(
              and(
                eq(showSubscriptionsTable.userId, userId),
                eq(showSubscriptionsTable.showId, showId)
              )
            )
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check subscription: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'show_subscriptions'
          })
      })

      if (existingSubscription.length === 0) {
        yield* Effect.tryPromise({
          try: () => db.insert(showSubscriptionsTable).values({ userId, showId }),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to subscribe: ${getErrorMessage(error)}`,
              operation: 'insert',
              table: 'show_subscriptions'
            })
        })
        yield* Effect.logInfo('[Favorites] Auto-subscribed to show', {
          userId,
          showId
        })
      }

      yield* recordFavoriteAdd()
      yield* Effect.logInfo('[Favorites] Show favorite added', {
        favoriteId: favorite.id,
        userId,
        showId
      })

      return favorite
    })
  )

const removeShowFavoriteEffect = (userId: string, showId: string) =>
  Effect.withSpan('favorite.removeShow', {
    attributes: { userId, showId }
  })(
    Effect.gen(function* () {
      const existingRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(favoritesTable)
            .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.showId, showId)))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to check existing favorite: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'favorites'
          })
      })

      if (existingRecords.length === 0) {
        return yield* new NotFoundError({
          message: 'Favorite not found',
          resource: 'favorite',
          id: `${userId}-${showId}`
        })
      }

      yield* Effect.tryPromise({
        try: () =>
          db
            .delete(favoritesTable)
            .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.showId, showId))),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to remove favorite: ${getErrorMessage(error)}`,
            operation: 'delete',
            table: 'favorites'
          })
      })

      // Auto-unsubscribe when unfavoriting a show
      yield* Effect.tryPromise({
        try: () =>
          db
            .delete(showSubscriptionsTable)
            .where(
              and(
                eq(showSubscriptionsTable.userId, userId),
                eq(showSubscriptionsTable.showId, showId)
              )
            ),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to unsubscribe: ${getErrorMessage(error)}`,
            operation: 'delete',
            table: 'show_subscriptions'
          })
      })
      yield* Effect.logInfo('[Favorites] Auto-unsubscribed from show', {
        userId,
        showId
      })

      yield* recordFavoriteRemove()
      yield* Effect.logInfo('[Favorites] Show favorite removed', {
        userId,
        showId
      })
    })
  )

const getFavoritesEffect = (
  userId: string,
  limit = 20,
  offset = 0
): Effect.Effect<FavoriteWithContent[], DatabaseError> =>
  Effect.withSpan('favorite.get', {
    attributes: { userId, limit, offset }
  })(
    Effect.gen(function* () {
      const favorites = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: favoritesTable.id,
              userId: favoritesTable.userId,
              audioId: favoritesTable.audioId,
              showId: favoritesTable.showId,
              createdAt: favoritesTable.createdAt,
              audio: {
                id: audioTable.id,
                title: audioTable.title,
                slug: audioTable.slug,
                thumbnailUrl: audioTable.thumbnailUrl,
                type: audioTable.type,
                url: audioTable.url
              },
              audioShowThumbnailUrl: audioShowsTable.thumbnailUrl,
              show: {
                id: showsTable.id,
                title: showsTable.title,
                slug: showsTable.slug,
                thumbnailUrl: showsTable.thumbnailUrl
              }
            })
            .from(favoritesTable)
            .leftJoin(audioTable, eq(favoritesTable.audioId, audioTable.id))
            .leftJoin(showsTable, eq(favoritesTable.showId, showsTable.id))
            .leftJoin(audioShowsTable, eq(audioTable.showId, audioShowsTable.id))
            .where(
              and(
                eq(favoritesTable.userId, userId),
                or(
                  and(isNotNull(favoritesTable.audioId), eq(audioTable.draft, false)),
                  and(isNotNull(favoritesTable.showId), eq(showsTable.draft, false))
                )
              )
            )
            .orderBy(desc(favoritesTable.createdAt))
            .limit(limit)
            .offset(offset),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get favorites: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'favorites'
          })
      })

      yield* Effect.logInfo('[Favorites] Favorites retrieved', {
        userId,
        count: favorites.length,
        limit,
        offset
      })

      return favorites.map(({ audioShowThumbnailUrl, ...favorite }) => ({
        ...favorite,
        audio: favorite.audio?.id
          ? {
              ...favorite.audio,
              thumbnailUrl: favorite.audio.thumbnailUrl ?? audioShowThumbnailUrl ?? null
            }
          : null,
        show: favorite.show?.id ? favorite.show : null
      }))
    })
  )

// Implementation - simple layer that provides access to the Effects
export const FavoriteServiceLayer = Layer.succeed(FavoriteService, {
  addFavorite: addFavoriteEffect,
  addShowFavorite: addShowFavoriteEffect,
  removeFavorite: removeFavoriteEffect,
  removeShowFavorite: removeShowFavoriteEffect,
  getFavorites: getFavoritesEffect
})
