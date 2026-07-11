import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const UrlPattern = /^https?:\/\/.+/i
const UrlString = Schema.String.pipe(Schema.check(Schema.isPattern(UrlPattern)))

const Creator = Schema.Struct({
  id: Schema.String,
  name: Schema.String
})

export const LabelResponse = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  slug: Schema.String,
  content: Schema.String,
  draft: Schema.Boolean,
  tags: Schema.NullOr(Schema.Array(Schema.String)),
  website: Schema.NullOr(Schema.String),
  discogs: Schema.NullOr(Schema.String),
  bandcamp: Schema.NullOr(Schema.String),
  genres: Schema.NullOr(Schema.Array(Schema.String)),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export const CompiledLabelResponse = Schema.Struct({
  ...LabelResponse.fields,
  compiledContent: Schema.String,
  creators: Schema.optional(Schema.Array(Creator))
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

export const GetAllLabelsResponse = Schema.Struct({
  data: Schema.Array(LabelResponse),
  pagination: PaginationMeta
})

const InsertLabelFields = {
  title: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.NonEmptyString,
  content: Schema.String,
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  website: Schema.optional(UrlString),
  discogs: Schema.optional(UrlString),
  bandcamp: Schema.optional(UrlString),
  genres: Schema.optional(Schema.Array(Schema.String))
}

export const CreateLabelInput = Schema.Struct({
  ...InsertLabelFields,
  // Old zod schema had .min(1) on creatorIds, but the handler already
  // treats an empty array the same as omitted (falls back to [user.id] via
  // creatorIds?.length ? creatorIds : [user.id]) -- same no-op constraint
  // pattern as shows' hostIds.
  creatorIds: Schema.optional(Schema.Array(Schema.String))
})
export type CreateLabelInput = typeof CreateLabelInput.Type

export const UpdateLabelInput = Schema.Struct({
  title: Schema.optional(Schema.NonEmptyString),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.NonEmptyString),
  content: Schema.optional(Schema.String),
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  website: Schema.optional(UrlString),
  discogs: Schema.optional(UrlString),
  bandcamp: Schema.optional(UrlString),
  genres: Schema.optional(Schema.Array(Schema.String))
})
export type UpdateLabelInput = typeof UpdateLabelInput.Type

export const LabelGroup = HttpApiGroup.make('label')
  .add(
    HttpApiEndpoint.post('createLabel', '/api/content/labels', {
      payload: CreateLabelInput,
      success: LabelResponse,
      error: [HttpApiError.Conflict, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getAllLabels', '/api/content/labels', {
      query: PaginationQuery,
      success: GetAllLabelsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getLabelBySlug', '/api/content/labels/:slug', {
      params: { slug: Schema.String },
      success: CompiledLabelResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.patch('updateLabelBySlug', '/api/content/labels/:slug', {
      params: { slug: Schema.String },
      payload: UpdateLabelInput,
      success: CompiledLabelResponse,
      error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
