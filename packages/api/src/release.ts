import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const UrlPattern = /^https?:\/\/.+/i
const UrlString = Schema.String.pipe(Schema.check(Schema.isPattern(UrlPattern)))

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Uuid = Schema.String.pipe(Schema.check(Schema.isPattern(UuidPattern)))

const StreamingLink = Schema.Struct({
  platform: Schema.String,
  url: UrlString
})

export const ReleaseResponse = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  slug: Schema.String,
  content: Schema.String,
  draft: Schema.Boolean,
  tags: Schema.NullOr(Schema.Array(Schema.String)),
  labelId: Schema.String,
  releaseDate: Schema.NullOr(Schema.String),
  streamingLinks: Schema.NullOr(Schema.Array(StreamingLink)),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export const CompiledReleaseResponse = Schema.Struct({
  ...ReleaseResponse.fields,
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

export const GetReleasesByLabelResponse = Schema.Struct({
  data: Schema.Array(ReleaseResponse),
  pagination: PaginationMeta
})

const baseReleaseFields = {
  title: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.NonEmptyString,
  content: Schema.String,
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  labelId: Uuid,
  streamingLinks: Schema.optional(Schema.Array(StreamingLink))
}

// releaseDate travels the wire as an ISO string in both directions (old
// route accepted z.string() and the handler did `new Date(...)` itself) --
// kept as a string here too, matching every other date field in this
// migration (createdAt/updatedAt).
export const CreateReleaseInput = Schema.Struct({
  ...baseReleaseFields,
  releaseDate: Schema.String
})
export type CreateReleaseInput = typeof CreateReleaseInput.Type

export const UpdateReleaseInput = Schema.Struct({
  title: Schema.optional(Schema.NonEmptyString),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.NonEmptyString),
  content: Schema.optional(Schema.String),
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  labelId: Schema.optional(Uuid),
  streamingLinks: Schema.optional(Schema.Array(StreamingLink)),
  releaseDate: Schema.optional(Schema.String)
})
export type UpdateReleaseInput = typeof UpdateReleaseInput.Type

export const DeleteReleaseResponse = Schema.Struct({
  message: Schema.String
})

export const ReleaseGroup = HttpApiGroup.make('release')
  .add(
    HttpApiEndpoint.post('createRelease', '/api/content/releases', {
      payload: CreateReleaseInput,
      success: ReleaseResponse,
      error: [
        HttpApiError.Conflict,
        HttpApiError.NotFound,
        HttpApiError.Unauthorized,
        HttpApiError.InternalServerError
      ]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getReleasesByLabel', '/api/content/labels/:labelSlug/releases', {
      params: { labelSlug: Schema.String },
      query: PaginationQuery,
      success: GetReleasesByLabelResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get(
      'getReleasesByLabelForEdit',
      '/api/content/labels/:labelSlug/releases/manage',
      {
        params: { labelSlug: Schema.String },
        query: PaginationQuery,
        success: GetReleasesByLabelResponse,
        error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
      }
    ).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getReleaseBySlug', '/api/content/releases/:slug', {
      params: { slug: Schema.String },
      success: CompiledReleaseResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get('getReleaseBySlugForEdit', '/api/content/releases/:slug/edit', {
      params: { slug: Schema.String },
      success: CompiledReleaseResponse,
      error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.patch('updateReleaseBySlug', '/api/content/releases/:slug', {
      params: { slug: Schema.String },
      payload: UpdateReleaseInput,
      success: CompiledReleaseResponse,
      error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete('deleteReleaseBySlug', '/api/content/releases/:slug', {
      params: { slug: Schema.String },
      success: DeleteReleaseResponse,
      error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
