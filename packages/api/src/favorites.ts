import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Uuid = Schema.String.pipe(Schema.check(Schema.isPattern(UuidPattern)))

// Exactly-one-of audioId/showId is enforced in the handler, not the schema.
export const AddFavoriteInput = Schema.Struct({
  audioId: Schema.optional(Uuid),
  showId: Schema.optional(Uuid)
})
export type AddFavoriteInput = typeof AddFavoriteInput.Type

export const FavoriteActionResponse = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.String
})

// Mirrors FavoriteService's FavoriteWithContent, apps/vps/src/services/favorite.service.ts.
const FavoriteAudio = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String),
  type: Schema.Literals(['mix', 'track', 'misc']),
  url: Schema.String
})

const FavoriteShow = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  slug: Schema.String,
  thumbnailUrl: Schema.NullOr(Schema.String)
})

export const FavoriteWithContent = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  audioId: Schema.NullOr(Schema.String),
  showId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  audio: Schema.NullOr(FavoriteAudio),
  show: Schema.NullOr(FavoriteShow)
})

export const GetFavoritesResponse = Schema.Struct({
  success: Schema.Boolean,
  favorites: Schema.Array(FavoriteWithContent),
  total: Schema.Number
})

const GetFavoritesQuery = {
  limit: Schema.optional(Schema.NumberFromString),
  offset: Schema.optional(Schema.NumberFromString)
}

export const FavoritesGroup = HttpApiGroup.make('favorites')
  .add(
    HttpApiEndpoint.post('addFavorite', '/api/favorites', {
      payload: AddFavoriteInput,
      success: FavoriteActionResponse,
      error: [HttpApiError.BadRequest, HttpApiError.Conflict, HttpApiError.NotFound]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete('removeFavorite', '/api/favorites/:audioId', {
      params: { audioId: Uuid },
      success: FavoriteActionResponse,
      error: HttpApiError.NotFound
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete('removeShowFavorite', '/api/favorites/show/:showId', {
      params: { showId: Uuid },
      success: FavoriteActionResponse,
      error: HttpApiError.NotFound
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getFavorites', '/api/favorites', {
      query: GetFavoritesQuery,
      success: GetFavoritesResponse
    }).middleware(AuthMiddleware)
  )
