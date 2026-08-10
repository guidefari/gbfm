import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { FavoriteService } from '@/services/favorite.service'

const dieOnDatabaseError = makeDieOnDatabaseError('favorites')

const toFavoriteResponse = (favorite: {
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
  show: { id: string; title: string; slug: string; thumbnailUrl: string | null } | null
}) => ({
  ...favorite,
  createdAt: favorite.createdAt.toISOString()
})

export const FavoritesHandlersLive = HttpApiBuilder.group(Api, 'favorites', (handlers) =>
  handlers
    .handle('addFavorite', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* FavoriteService

        if (payload.audioId) {
          yield* dieOnDatabaseError(
            svc.addFavorite(user.id, payload.audioId).pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('ConflictError', () => new HttpApiError.Conflict())
            )
          )
        } else if (payload.showId) {
          yield* dieOnDatabaseError(
            svc.addShowFavorite(user.id, payload.showId).pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('ConflictError', () => new HttpApiError.Conflict())
            )
          )
        } else {
          return yield* new HttpApiError.BadRequest()
        }

        return { success: true, message: 'Added to favorites' }
      })
    )
    .handle('removeFavorite', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* FavoriteService

        yield* dieOnDatabaseError(
          svc
            .removeFavorite(user.id, params.audioId)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return { success: true, message: 'Removed from favorites' }
      })
    )
    .handle('removeShowFavorite', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* FavoriteService

        yield* dieOnDatabaseError(
          svc
            .removeShowFavorite(user.id, params.showId)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return { success: true, message: 'Removed from favorites' }
      })
    )
    .handle('getFavorites', ({ query }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* FavoriteService

        const favorites = yield* dieOnDatabaseError(
          svc.getFavorites(user.id, query.limit, query.offset)
        )

        return {
          success: true,
          favorites: favorites.map(toFavoriteResponse),
          total: favorites.length
        }
      })
    )
)
