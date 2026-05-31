import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
import { runAppFork } from '@/runtime'
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
    const svc = yield* FavoriteService
    if (audioId) yield* svc.addFavorite(user.id, audioId)
    else if (showId) yield* svc.addShowFavorite(user.id, showId)
    return { success: true, message: 'Added to favorites' } as const
  })

  return runEffect<AddFavoriteRoute>(c, program, HttpStatusCodes.CREATED)
}

export const removeFavorite: AppRouteHandler<RemoveFavoriteRoute> = async (c) => {
  const user = c.get('user')
  const { audioId } = c.req.valid('param')

  Effect.logInfo('[API] Remove favorite requested', {
    userId: user.id,
    audioId
  }).pipe(runAppFork)

  const program = Effect.gen(function* () {
    const svc = yield* FavoriteService
    yield* svc.removeFavorite(user.id, audioId)
    return { success: true, message: 'Removed from favorites' } as const
  })

  return runEffect<RemoveFavoriteRoute>(c, program)
}

export const removeShowFavorite: AppRouteHandler<RemoveShowFavoriteRoute> = async (c) => {
  const user = c.get('user')
  const { showId } = c.req.valid('param')

  Effect.logInfo('[API] Remove show favorite requested', {
    userId: user.id,
    showId
  }).pipe(runAppFork)

  const program = Effect.gen(function* () {
    const svc = yield* FavoriteService
    yield* svc.removeShowFavorite(user.id, showId)
    return { success: true, message: 'Removed from favorites' } as const
  })

  return runEffect<RemoveShowFavoriteRoute>(c, program)
}

export const getFavorites: AppRouteHandler<GetFavoritesRoute> = async (c) => {
  const user = c.get('user')
  const { limit, offset } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const svc = yield* FavoriteService
    const favorites = yield* svc.getFavorites(user.id, limit, offset)
    return {
      success: true,
      favorites: favorites.map((fav) => ({
        ...fav,
        createdAt: fav.createdAt.toISOString()
      })),
      total: favorites.length
    } as const
  })

  return runEffect<GetFavoritesRoute>(c, program)
}
