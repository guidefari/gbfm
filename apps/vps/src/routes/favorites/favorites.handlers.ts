import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { AppRuntime, runAppFork } from '@/runtime'
import { FavoriteService } from '@/services/favorite.service'

import type {
  AddFavoriteRoute,
  GetFavoritesRoute,
  RemoveFavoriteRoute,
  RemoveShowFavoriteRoute
} from './favorites.routes'

export const addFavorite: AppRouteHandler<AddFavoriteRoute> = async (c) => {
  const user = c.get('user')
  const { audioId, showId } = c.req.valid('json')

  Effect.annotateCurrentSpan('userId', user.id).pipe(runAppFork)
  Effect.annotateCurrentSpan('operation', 'add-favorite').pipe(runAppFork)

  Effect.logInfo('[API] Add favorite requested', {
    userId: user.id,
    audioId,
    showId
  }).pipe(runAppFork)

  const program = Effect.gen(function* () {
    const favoriteService = yield* FavoriteService
    if (audioId) {
      yield* favoriteService.addFavorite(user.id, audioId)
    } else if (showId) {
      yield* favoriteService.addShowFavorite(user.id, showId)
    }
    return { success: true, message: 'Added to favorites' } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('ConflictError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.CONFLICT
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    Effect.logWarning('[API] Add favorite failed', {
      userId: user.id,
      audioId,
      error: result.error,
      statusCode: result.status
    }).pipe(runAppFork)
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result, HttpStatusCodes.CREATED)
}

export const removeFavorite: AppRouteHandler<RemoveFavoriteRoute> = async (
  c
) => {
  const user = c.get('user')
  const { audioId } = c.req.valid('param')

  Effect.logInfo('[API] Remove favorite requested', {
    userId: user.id,
    audioId
  }).pipe(runAppFork)

  const program = Effect.gen(function* () {
    const favoriteService = yield* FavoriteService
    yield* favoriteService.removeFavorite(user.id, audioId)
    return { success: true, message: 'Removed from favorites' } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result)
}

export const removeShowFavorite: AppRouteHandler<
  RemoveShowFavoriteRoute
> = async (c) => {
  const user = c.get('user')
  const { showId } = c.req.valid('param')

  Effect.logInfo('[API] Remove show favorite requested', {
    userId: user.id,
    showId
  }).pipe(runAppFork)

  const program = Effect.gen(function* () {
    const favoriteService = yield* FavoriteService
    yield* favoriteService.removeShowFavorite(user.id, showId)
    return { success: true, message: 'Removed from favorites' } as const
  }).pipe(
    Effect.catchTag('NotFoundError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.NOT_FOUND
      } as const)
    ),
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result)
}

export const getFavorites: AppRouteHandler<GetFavoritesRoute> = async (c) => {
  const user = c.get('user')
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const favoriteService = yield* FavoriteService
    const favorites = yield* favoriteService.getFavorites(
      user.id,
      limit,
      offset
    )
    const formattedFavorites = favorites.map((fav) => ({
      ...fav,
      createdAt: fav.createdAt.toISOString()
    }))
    return {
      success: true,
      favorites: formattedFavorites,
      total: favorites.length
    } as const
  }).pipe(
    Effect.catchTag('DatabaseError', (e) =>
      Effect.succeed({
        error: e.message,
        status: HttpStatusCodes.INTERNAL_SERVER_ERROR
      } as const)
    )
  )

  const result = await AppRuntime.runPromise(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json(result)
}
