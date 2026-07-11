import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

// Mirrors apps/vps/src/db/music-entity.schema.ts's selectMusicArtistSchema
// (Zod, DB-facing) -- response fields are nullable to match actual column
// nullability, not because the API wants to encourage nulls.
export const ArtistResponse = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  bio: Schema.NullOr(Schema.String),
  imageUrl: Schema.NullOr(Schema.String),
  genres: Schema.NullOr(Schema.Array(Schema.String)),
  slug: Schema.String,
  publishedAt: Schema.NullOr(Schema.String),
  createdById: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String
})
export type ArtistResponse = typeof ArtistResponse.Type

export const ArtistListResponse = Schema.Array(ArtistResponse)

// slug is required on create (mirrors insertMusicArtistSchema) -- the
// service does not derive it here, unlike update. createdById is not part
// of the payload; the handler injects it from AuthSession.
export const CreateArtistInput = Schema.Struct({
  name: Schema.String,
  bio: Schema.optional(Schema.String),
  imageUrl: Schema.optional(Schema.String),
  genres: Schema.optional(Schema.Array(Schema.String)),
  slug: Schema.String,
  publishedAt: Schema.optional(Schema.String)
})
export type CreateArtistInput = typeof CreateArtistInput.Type

// All fields optional (mirrors updateMusicArtistSchema = insert.partial()).
// If name is sent without slug, the handler derives slug from name --
// asymmetric with create, preserved intentionally from the Hono behavior.
export const UpdateArtistInput = Schema.Struct({
  name: Schema.optional(Schema.String),
  bio: Schema.optional(Schema.String),
  imageUrl: Schema.optional(Schema.String),
  genres: Schema.optional(Schema.Array(Schema.String)),
  slug: Schema.optional(Schema.String),
  publishedAt: Schema.optional(Schema.String)
})
export type UpdateArtistInput = typeof UpdateArtistInput.Type

const artistIdParam = { id: Schema.String }

const ArtistJunctionInput = Schema.Struct({
  role: Schema.optional(Schema.String),
  displayOrder: Schema.optional(Schema.Number)
})

export const MusicGroup = HttpApiGroup.make('music')
  .add(HttpApiEndpoint.get('listArtists', '/api/music/artists', { success: ArtistListResponse }))
  .add(
    HttpApiEndpoint.post('createArtist', '/api/music/artists', {
      payload: CreateArtistInput,
      success: ArtistResponse,
      error: HttpApiError.Forbidden
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getArtist', '/api/music/artists/:id', {
      params: artistIdParam,
      success: ArtistResponse,
      error: HttpApiError.NotFound
    })
  )
  .add(
    HttpApiEndpoint.patch('updateArtist', '/api/music/artists/:id', {
      params: artistIdParam,
      payload: UpdateArtistInput,
      success: ArtistResponse,
      error: [HttpApiError.NotFound, HttpApiError.Forbidden]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete('deleteArtist', '/api/music/artists/:id', {
      params: artistIdParam,
      success: HttpApiSchema.NoContent,
      error: [HttpApiError.NotFound, HttpApiError.Forbidden]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.put('addArtistToAlbum', '/api/music/albums/:albumId/artists/:artistId', {
      params: { albumId: Schema.String, artistId: Schema.String },
      payload: ArtistJunctionInput,
      success: HttpApiSchema.NoContent,
      error: HttpApiError.Forbidden
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete(
      'removeArtistFromAlbum',
      '/api/music/albums/:albumId/artists/:artistId',
      {
        params: { albumId: Schema.String, artistId: Schema.String },
        success: HttpApiSchema.NoContent,
        error: HttpApiError.Forbidden
      }
    ).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.put('addArtistToTrack', '/api/music/tracks/:trackId/artists/:artistId', {
      params: { trackId: Schema.String, artistId: Schema.String },
      payload: ArtistJunctionInput,
      success: HttpApiSchema.NoContent,
      error: HttpApiError.Forbidden
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete(
      'removeArtistFromTrack',
      '/api/music/tracks/:trackId/artists/:artistId',
      {
        params: { trackId: Schema.String, artistId: Schema.String },
        success: HttpApiSchema.NoContent,
        error: HttpApiError.Forbidden
      }
    ).middleware(AuthMiddleware)
  )
