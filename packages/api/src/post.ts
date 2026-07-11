import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Uuid = Schema.String.pipe(Schema.check(Schema.isPattern(UuidPattern)))

// effect@4.0.0-beta.93's HttpApiError has no built-in 422 -- the old routes
// declared UNPROCESSABLE_ENTITY for post/audio validation failures
// (PostService.create/.update's ValidationError, mapped by the old
// effect-hono.ts mapErrors), so it's declared here the same way admin.ts
// declares a custom 429.
export class ValidationHttpError extends Schema.TaggedErrorClass<ValidationHttpError>()(
  'ValidationHttpError',
  {},
  { httpApiStatus: 422 }
) {}

const PostType = Schema.Literals(['post', 'micro'])
const MusicEntityType = Schema.Literals(['album', 'track', 'playlist'])

const Creator = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  username: Schema.NullOr(Schema.String)
})

export const PostResponse = Schema.Struct({
  id: Schema.String,
  title: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  thumbnailUrl: Schema.NullOr(Schema.String),
  slug: Schema.String,
  content: Schema.NullOr(Schema.String),
  draft: Schema.Boolean,
  tags: Schema.NullOr(Schema.Array(Schema.String)),
  type: Schema.NullOr(PostType),
  musicEntityType: Schema.NullOr(Schema.String),
  musicEntityId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export const CompiledPostResponse = Schema.Struct({
  ...PostResponse.fields,
  compiledContent: Schema.String,
  creators: Schema.optional(Schema.Array(Creator))
})

export const CompiledEditorialPostResponse = Schema.Struct({
  ...CompiledPostResponse.fields,
  title: Schema.String,
  content: Schema.String,
  type: Schema.Literal('post')
})

export const CompiledMicroPostResponse = Schema.Struct({
  ...CompiledPostResponse.fields,
  type: Schema.Literal('micro')
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

export const GetPostsQuery = {
  ...PaginationQuery,
  type: Schema.optional(PostType)
}

export const GetPostsResponse = Schema.Struct({
  data: Schema.Array(CompiledPostResponse),
  pagination: PaginationMeta
})

export const GetEditorialPostsQuery = {
  ...PaginationQuery,
  tag: Schema.optional(Schema.String)
}

export const GetEditorialPostsResponse = Schema.Struct({
  data: Schema.Array(CompiledEditorialPostResponse),
  pagination: PaginationMeta
})

export const GetMicroPostsResponse = Schema.Struct({
  data: Schema.Array(CompiledMicroPostResponse),
  pagination: PaginationMeta
})

export const GetPostsByTagResponse = Schema.Struct({
  data: Schema.Array(PostResponse),
  pagination: PaginationMeta
})

export const GetEditorialTagsResponse = Schema.Array(Schema.String)

const insertPostFields = {
  title: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.NonEmptyString,
  content: Schema.optional(Schema.NullOr(Schema.String)),
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  type: Schema.optional(Schema.NullOr(PostType)),
  musicEntityType: Schema.optional(Schema.NullOr(MusicEntityType)),
  musicEntityId: Schema.optional(Schema.NullOr(Uuid))
}

export const CreatePostInput = Schema.Struct({
  ...insertPostFields,
  // Old zod schema had .min(1) on creatorIds, but the handler already
  // treats an empty array the same as omitted (falls back to [user.id]),
  // same no-op pattern established for shows/label.
  creatorIds: Schema.optional(Schema.Array(Schema.String))
})
export type CreatePostInput = typeof CreatePostInput.Type

export const UpdatePostInput = Schema.Struct({
  title: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.NonEmptyString),
  content: Schema.optional(Schema.NullOr(Schema.String)),
  draft: Schema.optional(Schema.Boolean),
  tags: Schema.optional(Schema.Array(Schema.String)),
  type: Schema.optional(Schema.NullOr(PostType)),
  musicEntityType: Schema.optional(Schema.NullOr(MusicEntityType)),
  musicEntityId: Schema.optional(Schema.NullOr(Uuid)),
  creatorIds: Schema.optional(Schema.Array(Schema.String))
})
export type UpdatePostInput = typeof UpdatePostInput.Type

const TagParam = { tag: Schema.NonEmptyString }
const SlugParam = { slug: Schema.String }

export const PostGroup = HttpApiGroup.make('post')
  .add(
    HttpApiEndpoint.get('getPosts', '/api/content/posts', {
      query: GetPostsQuery,
      success: GetPostsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getEditorialTags', '/api/content/posts/editorials/tags', {
      success: GetEditorialTagsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getEditorialPosts', '/api/content/posts/editorials', {
      query: GetEditorialPostsQuery,
      success: GetEditorialPostsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getEditorialPostBySlug', '/api/content/posts/editorials/:slug', {
      params: SlugParam,
      success: CompiledEditorialPostResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get('getMicroPosts', '/api/content/posts/micro', {
      query: PaginationQuery,
      success: GetMicroPostsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getMicroPostBySlug', '/api/content/posts/micro/:slug', {
      params: SlugParam,
      success: CompiledMicroPostResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get('getPostBySlug', '/api/content/posts/:slug', {
      params: SlugParam,
      success: CompiledPostResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.post('createPost', '/api/content/post', {
      payload: CreatePostInput,
      success: PostResponse,
      error: [ValidationHttpError, HttpApiError.Conflict, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.patch('updatePostBySlug', '/api/content/posts/:slug', {
      params: SlugParam,
      payload: UpdatePostInput,
      success: CompiledPostResponse,
      error: [
        ValidationHttpError,
        HttpApiError.NotFound,
        HttpApiError.Unauthorized,
        HttpApiError.InternalServerError
      ]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getPostsByTag', '/api/content/tag/:tag', {
      params: TagParam,
      query: PaginationQuery,
      success: GetPostsByTagResponse,
      error: HttpApiError.InternalServerError
    })
  )
