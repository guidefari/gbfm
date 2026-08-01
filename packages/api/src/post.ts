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
  parentPostId: Schema.NullOr(Schema.String),
  rootPostId: Schema.NullOr(Schema.String),
  depth: Schema.Number,
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

export const GetMicroTagsResponse = Schema.Array(Schema.String)

export const GetMicroPostsQuery = {
  ...PaginationQuery,
  tag: Schema.optional(Schema.String)
}

const MicroPostSummary = Schema.Struct({
  slug: Schema.String,
  title: Schema.NullOr(Schema.String)
})

export const GetAdjacentMicroPostsResponse = Schema.Struct({
  prev: Schema.NullOr(MicroPostSummary),
  next: Schema.NullOr(MicroPostSummary)
})

export const GetRandomMicroPostResponse = Schema.Struct({
  slug: Schema.String
})

// Comma-joined string, not Schema.Array -- no existing endpoint in this
// package puts Schema.Array in a `query` field, so there's no proven
// pattern for how Effect HttpApi encodes/decodes an array-valued query
// param. Encoding as a single comma-joined string and splitting
// server-side avoids being the first to find out.
const GetRandomMicroPostQuery = {
  exclude: Schema.optional(Schema.String)
}

const SearchMicroPostsQuery = {
  ...PaginationQuery,
  q: Schema.NonEmptyString
}

const insertPostFields = {
  title: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.String),
  thumbnailUrl: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.NonEmptyString),
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
const ParentSlugParam = { parentSlug: Schema.String }

export const CreateMicroPostReplyInput = Schema.Struct({
  title: Schema.optional(Schema.NullOr(Schema.String)),
  content: Schema.optional(Schema.NullOr(Schema.String)),
  musicEntityType: Schema.optional(Schema.NullOr(MusicEntityType)),
  musicEntityId: Schema.optional(Schema.NullOr(Uuid))
})
export type CreateMicroPostReplyInput = typeof CreateMicroPostReplyInput.Type

export const MicroPostThreadResponse = Schema.Struct({
  root: CompiledMicroPostResponse,
  focus: CompiledMicroPostResponse,
  posts: Schema.Array(CompiledMicroPostResponse),
  pagination: PaginationMeta
})

export const PostGroup = HttpApiGroup.make('post')
  .add(
    HttpApiEndpoint.get('getPosts', '/api/content/posts', {
      query: GetPostsQuery,
      success: GetPostsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getPostsForEdit', '/api/content/posts/manage', {
      query: GetPostsQuery,
      success: GetPostsResponse,
      error: [HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
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
      query: GetMicroPostsQuery,
      success: GetMicroPostsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getMicroTags', '/api/content/posts/micro/tags', {
      success: GetMicroTagsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('searchMicroPosts', '/api/content/posts/micro/search', {
      query: SearchMicroPostsQuery,
      success: GetMicroPostsResponse,
      error: HttpApiError.InternalServerError
    })
  )
  .add(
    HttpApiEndpoint.get('getRandomMicroPost', '/api/content/posts/micro/random', {
      query: GetRandomMicroPostQuery,
      success: GetRandomMicroPostResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get('getAdjacentMicroPosts', '/api/content/posts/micro/:slug/adjacent', {
      params: SlugParam,
      success: GetAdjacentMicroPostsResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
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
    HttpApiEndpoint.post('createMicroPostReply', '/api/content/posts/micro/:parentSlug/replies', {
      params: ParentSlugParam,
      payload: CreateMicroPostReplyInput,
      success: CompiledMicroPostResponse,
      error: [
        ValidationHttpError,
        HttpApiError.NotFound,
        HttpApiError.Conflict,
        HttpApiError.InternalServerError
      ]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('getMicroPostReplies', '/api/content/posts/micro/:parentSlug/replies', {
      params: ParentSlugParam,
      query: PaginationQuery,
      success: GetMicroPostsResponse,
      error: [HttpApiError.NotFound, HttpApiError.InternalServerError]
    })
  )
  .add(
    HttpApiEndpoint.get('getMicroPostThread', '/api/content/posts/micro/:slug/thread', {
      params: SlugParam,
      query: PaginationQuery,
      success: MicroPostThreadResponse,
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
    HttpApiEndpoint.get('getPostBySlugForEdit', '/api/content/posts/:slug/edit', {
      params: SlugParam,
      success: CompiledPostResponse,
      error: [HttpApiError.NotFound, HttpApiError.Unauthorized, HttpApiError.InternalServerError]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('createPost', '/api/content/post', {
      payload: CreatePostInput,
      success: PostResponse,
      error: [
        ValidationHttpError,
        HttpApiError.Forbidden,
        HttpApiError.Conflict,
        HttpApiError.InternalServerError
      ]
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
