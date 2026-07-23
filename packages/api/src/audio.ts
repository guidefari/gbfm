import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Uuid = Schema.String.pipe(Schema.check(Schema.isPattern(UuidPattern)))

const UrlPattern = /^https?:\/\/.+/i
const UrlString = Schema.String.pipe(Schema.check(Schema.isPattern(UrlPattern)))

const AudioType = Schema.Literals(['mix', 'track', 'misc'])

const Creator = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.NullOr(Schema.String)
})

export const AudioResponse = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  slug: Schema.String,
  content: Schema.String,
  draft: Schema.Boolean,
  tags: Schema.NullOr(Schema.Array(Schema.String)),
  type: AudioType,
  url: Schema.String,
  showId: Schema.NullOr(Schema.String),
  episodeNumber: Schema.NullOr(Schema.Number),
  playCount: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  creators: Schema.optional(Schema.Array(Creator))
})

export const CompiledAudioResponse = Schema.Struct({
  ...AudioResponse.fields,
  compiledContent: Schema.String
})

const PaginationMeta = Schema.Struct({
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  hasMore: Schema.Boolean
})

const PaginationQuery = {
  limit: Schema.optional(
    Schema.NumberFromString.pipe(Schema.check(Schema.isBetween({ minimum: 1, maximum: 100 })))
  ),
  offset: Schema.optional(
    Schema.NumberFromString.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  )
}

export const GetAudioByTypeQuery = {
  ...PaginationQuery,
  tag: Schema.optional(Schema.String)
}

export const GetAudioByTypeResponse = Schema.Struct({
  data: Schema.Array(AudioResponse),
  pagination: PaginationMeta
})

export const GetAudioTagsResponse = Schema.Array(Schema.String)

const insertAudioFields = {
  title: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.NonEmptyString,
  content: Schema.String,
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  type: AudioType,
  url: UrlString,
  showId: Schema.optional(Uuid),
  episodeNumber: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))))
}

export const CreateAudioInput = Schema.Struct({
  ...insertAudioFields,
  idempotencyKey: Uuid,
  // Old zod schema had .min(1) on creatorIds, but the handler already
  // treats an empty array the same as omitted (falls back to [user.id]),
  // same no-op pattern established for shows/label/post.
  creatorIds: Schema.optional(Schema.Array(Schema.String))
})
export type CreateAudioInput = typeof CreateAudioInput.Type

// updateAudioSchema (old) omits `type` from the body since it's already in
// the URL param -- this endpoint's payload does the same.
export const UpdateAudioInput = Schema.Struct({
  title: Schema.optional(Schema.NonEmptyString),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.NonEmptyString),
  content: Schema.optional(Schema.String),
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  url: Schema.optional(UrlString),
  showId: Schema.optional(Uuid),
  episodeNumber: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))),
  creatorIds: Schema.optional(Schema.Array(Schema.String))
})
export type UpdateAudioInput = typeof UpdateAudioInput.Type

export const TrackAudioPlayResponse = Schema.Struct({
  playCount: Schema.Int
})

export const GetMixQRPdfResponse = Schema.Struct({
  url: Schema.String,
  cached: Schema.Boolean
})

const GetMixQRPdfQuery = {
  force: Schema.optional(Schema.Literal('true'))
}

const AudioTypeParam = { type: AudioType }
const AudioTypeSlugParams = { type: AudioType, slug: Schema.String }

export const AudioGroup = HttpApiGroup.make('audio')
  .add(
    HttpApiEndpoint.post('createMix', '/api/content/mixes', {
      payload: CreateAudioInput,
      success: AudioResponse,
      error: [HttpApiError.Conflict, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getAudioTags', '/api/content/audio/:type/tags', {
      params: AudioTypeParam,
      success: GetAudioTagsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getAudioByType', '/api/content/audio/:type', {
      params: AudioTypeParam,
      query: GetAudioByTypeQuery,
      success: GetAudioByTypeResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getAudioBySlug', '/api/content/audio/:type/:slug', {
      params: AudioTypeSlugParams,
      success: CompiledAudioResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get('getAudioBySlugForEdit', '/api/content/audio/:type/:slug/edit', {
      params: AudioTypeSlugParams,
      success: CompiledAudioResponse,
      error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.patch('updateAudioBySlug', '/api/content/audio/:type/:slug', {
      params: AudioTypeSlugParams,
      payload: UpdateAudioInput,
      success: CompiledAudioResponse,
      error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('createAudio', '/api/content/audio', {
      payload: CreateAudioInput,
      success: AudioResponse,
      error: [HttpApiError.Conflict, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('trackAudioPlay', '/api/content/audio/:id/play', {
      params: { id: Uuid },
      success: TrackAudioPlayResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get('getMixQRPdf', '/api/content/audio/mix/:slug/qr-pdf', {
      params: { slug: Schema.String },
      query: GetMixQRPdfQuery,
      success: GetMixQRPdfResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
