import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { favoritesTable, type SelectFavorite } from '@/db/favorites.schema'
import { ConflictError, DatabaseError, NotFoundError } from '@/errors'

// Service interface
export interface FavoriteService {
  readonly addFavorite: (
    userId: string,
    audioId: string
  ) => Effect.Effect<
    SelectFavorite,
    DatabaseError | NotFoundError | ConflictError
  >
  readonly removeFavorite: (
    userId: string,
    audioId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly getFavorites: (
    userId: string,
    limit?: number,
    offset?: number
  ) => Effect.Effect<
    {
      id: string
      userId: string
      audioId: string
      createdAt: Date
      audio: {
        id: string
        title: string
        slug: string
        thumbnailUrl: string | null
        type: 'mix' | 'track' | 'misc'
        url: string
      }
    }[],
    DatabaseError
  >
}

// Service tag for dependency injection
export const FavoriteService =
  Context.GenericTag<FavoriteService>('FavoriteService')

// Core service logic - pure Effects with no service dependencies
const addFavoriteEffect = (userId: string, audioId: string) =>
  Effect.gen(function* () {
    return yield* Effect.withSpan('favorite.add', {
      attributes: { userId, audioId }
    })(
      Effect.gen(function* () {
        // Check if audio exists
        const audioRecords = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(audioTable)
              .where(eq(audioTable.id, audioId))
              .limit(1),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to check audio existence: ${(error as Error).message}`,
              operation: 'select',
              table: 'audio'
            })
        })

        if (audioRecords.length === 0) {
          return yield* Effect.fail(
            new NotFoundError({
              message: 'Audio not found',
              resource: 'audio',
              id: audioId
            })
          )
        }

        // Check if already favorited
        const existingRecords = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(favoritesTable)
              .where(
                and(
                  eq(favoritesTable.userId, userId),
                  eq(favoritesTable.audioId, audioId)
                )
              )
              .limit(1),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to check existing favorite: ${(error as Error).message}`,
              operation: 'select',
              table: 'favorites'
            })
        })

        if (existingRecords.length > 0) {
          return yield* Effect.fail(
            new ConflictError({
              message: 'Already favorited',
              resource: 'favorite',
              id: `${userId}-${audioId}`
            })
          )
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
              message: `Failed to add favorite: ${(error as Error).message}`,
              operation: 'insert',
              table: 'favorites'
            })
        })

        if (insertedRecords.length === 0) {
          return yield* Effect.fail(
            new DatabaseError({
              message: 'Failed to create favorite record',
              operation: 'insert',
              table: 'favorites'
            })
          )
        }

        const favorite = insertedRecords[0]
        if (!favorite) {
          return yield* Effect.fail(
            new DatabaseError({
              message: 'Failed to create favorite record',
              operation: 'insert',
              table: 'favorites'
            })
          )
        }

        yield* Effect.logInfo('[Favorites] Favorite added', {
          userId,
          audioId,
          favoriteId: favorite.id
        })

        return favorite
      })
    )
  })

const removeFavoriteEffect = (userId: string, audioId: string) =>
  Effect.gen(function* () {
    return yield* Effect.withSpan('favorite.remove', {
      attributes: { userId, audioId }
    })(
      Effect.gen(function* () {
        // Check if favorite exists
        const existingRecords = yield* Effect.tryPromise({
          try: () =>
            db
              .select()
              .from(favoritesTable)
              .where(
                and(
                  eq(favoritesTable.userId, userId),
                  eq(favoritesTable.audioId, audioId)
                )
              )
              .limit(1),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to check favorite existence: ${(error as Error).message}`,
              operation: 'select',
              table: 'favorites'
            })
        })

        if (existingRecords.length === 0) {
          return yield* Effect.fail(
            new NotFoundError({
              message: 'Favorite not found',
              resource: 'favorite',
              id: `${userId}-${audioId}`
            })
          )
        }

        // Remove favorite
        yield* Effect.tryPromise({
          try: () =>
            db
              .delete(favoritesTable)
              .where(
                and(
                  eq(favoritesTable.userId, userId),
                  eq(favoritesTable.audioId, audioId)
                )
              ),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to remove favorite: ${(error as Error).message}`,
              operation: 'delete',
              table: 'favorites'
            })
        })

        yield* Effect.logInfo('[Favorites] Favorite removed', {
          userId,
          audioId
        })
      })
    )
  })

const getFavoritesEffect = (userId: string, limit = 20, offset = 0) =>
  Effect.gen(function* () {
    return yield* Effect.withSpan('favorite.get', {
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
                createdAt: favoritesTable.createdAt,
                audio: {
                  id: audioTable.id,
                  title: audioTable.title,
                  slug: audioTable.slug,
                  thumbnailUrl: audioTable.thumbnailUrl,
                  type: audioTable.type,
                  url: audioTable.url
                }
              })
              .from(favoritesTable)
              .innerJoin(audioTable, eq(favoritesTable.audioId, audioTable.id))
              .where(eq(favoritesTable.userId, userId))
              .orderBy(favoritesTable.createdAt)
              .limit(limit)
              .offset(offset),
          catch: (error) =>
            new DatabaseError({
              message: `Failed to get favorites: ${(error as Error).message}`,
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

        return favorites
      })
    )
  })

// Implementation - simple layer that provides access to the Effects
export const FavoriteServiceLive = Layer.succeed(FavoriteService, {
  addFavorite: addFavoriteEffect,
  removeFavorite: removeFavoriteEffect,
  getFavorites: getFavoritesEffect
})
