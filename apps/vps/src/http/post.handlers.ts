import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { canCreatePosts } from '@gbfm/core/roles'
import {
  GetEditorialPostsResponse,
  GetEditorialTagsResponse,
  GetMicroTagsResponse,
  ValidationHttpError
} from '@gbfm/api/post'
import { Effect, Schema } from 'effect'
import { HttpServerResponse } from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { PostService } from '@/services/post.service'

const dieOnDatabaseError = makeDieOnDatabaseError('post')

const toDateStrings = <
  T extends {
    createdAt: Date
    updatedAt: Date
    blueskySource?: {
      readonly authorDid: string
      readonly authorHandle: string | null
      readonly publicUrl: string
      readonly sourceCreatedAt: Date | string
      readonly sourceStatus: string
      readonly locallyEdited: boolean
      readonly lastError: string | null
    }
  }
>(
  post: T
) => ({
  ...post,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
  ...(post.blueskySource
    ? {
        blueskySource: {
          ...post.blueskySource,
          sourceCreatedAt:
            typeof post.blueskySource.sourceCreatedAt === 'string'
              ? post.blueskySource.sourceCreatedAt
              : post.blueskySource.sourceCreatedAt.toISOString()
        }
      }
    : {})
})

export const PostHandlersLive = HttpApiBuilder.group(Api, 'post', (handlers) =>
  handlers
    .handle('getPosts', ({ query }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc.getAll({ limit: query.limit ?? 20, offset: query.offset ?? 0, type: query.type })
        )

        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
    .handle('getPostsForEdit', ({ query }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc.getAllForEdit(
            {
              limit: query.limit ?? 20,
              offset: query.offset ?? 0,
              type: query.type,
              source: query.source,
              draft: query.status === undefined ? undefined : query.status === 'draft',
              q: query.q
            },
            user.id,
            user.role ?? 'user'
          )
        )
        return { data: result.data.map(toDateStrings), pagination: result.pagination }
      })
    )
    .handle('getEditorialTags', () =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const tags = yield* dieOnDatabaseError(svc.getEditorialTags())
        const body = yield* Schema.encodeEffect(GetEditorialTagsResponse)(tags).pipe(Effect.orDie)
        return HttpServerResponse.setHeader(
          yield* HttpServerResponse.json(body).pipe(Effect.orDie),
          'Cache-Control',
          'public, max-age=3600, stale-while-revalidate=86400'
        )
      })
    )
    .handle('getEditorialPosts', ({ query }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc.getEditorials({ limit: query.limit ?? 20, offset: query.offset ?? 0, tag: query.tag })
        )

        const body = {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
        const encoded = yield* Schema.encodeEffect(GetEditorialPostsResponse)(body).pipe(
          Effect.orDie
        )
        return HttpServerResponse.setHeader(
          yield* HttpServerResponse.json(encoded).pipe(Effect.orDie),
          'Cache-Control',
          'public, max-age=60, stale-while-revalidate=300'
        )
      })
    )
    .handle('getEditorialPostBySlug', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const post = yield* dieOnDatabaseError(
          svc
            .getEditorialBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return toDateStrings(post)
      })
    )
    .handle('getMicroPosts', ({ query }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc.getMicroPosts({ limit: query.limit ?? 20, offset: query.offset ?? 0, tag: query.tag })
        )

        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
    .handle('getMicroTags', () =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const tags = yield* dieOnDatabaseError(svc.getMicroTags())
        const body = yield* Schema.encodeEffect(GetMicroTagsResponse)(tags).pipe(Effect.orDie)
        return HttpServerResponse.setHeader(
          yield* HttpServerResponse.json(body).pipe(Effect.orDie),
          'Cache-Control',
          'public, max-age=3600, stale-while-revalidate=86400'
        )
      })
    )
    .handle('searchMicroPosts', ({ query }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc.searchMicroPosts({ q: query.q, limit: query.limit ?? 20, offset: query.offset ?? 0 })
        )

        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
    .handle('getRandomMicroPost', ({ payload }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const excludeSlugs = [...(payload.exclude ?? [])]
        const result = yield* dieOnDatabaseError(
          svc
            .getRandomMicroPost(excludeSlugs)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return result
      })
    )
    .handle('getAdjacentMicroPosts', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc
            .getAdjacentMicroPosts(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return result
      })
    )
    .handle('getMicroPostBySlug', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const post = yield* dieOnDatabaseError(
          svc
            .getMicroPostBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return toDateStrings(post)
      })
    )
    .handle('getMicroPostById', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const post = yield* dieOnDatabaseError(
          svc
            .getMicroPostById(params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return toDateStrings(post)
      })
    )
    .handle('createMicroPostReply', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* PostService
        const reply = yield* dieOnDatabaseError(
          svc
            .createMicroPostReply({
              parentSlug: params.parentSlug,
              actorUserId: user.id,
              title: payload.title,
              content: payload.content,
              musicEntityType: payload.musicEntityType,
              musicEntityId: payload.musicEntityId,
              quotedPostId: payload.quotedPostId
            })
            .pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()),
              Effect.catchTag('ValidationError', () => new ValidationHttpError()),
              Effect.catchTag('ParentPostNotReplyableError', () => new ValidationHttpError()),
              Effect.catchTag('QuotedPostNotEmbeddableError', () => new ValidationHttpError())
            )
        )

        return toDateStrings(reply)
      })
    )
    .handle('getMicroPostReplies', ({ params, query }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc
            .getMicroPostReplies(params.parentSlug, {
              limit: query.limit ?? 20,
              offset: query.offset ?? 0
            })
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
    .handle('getMicroPostThread', ({ params, query }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc
            .getMicroPostThread(params.slug, {
              limit: query.limit ?? 20,
              offset: query.offset ?? 0
            })
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return {
          root: toDateStrings(result.root),
          focus: toDateStrings(result.focus),
          posts: result.posts.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
    .handle('getPostBySlug', ({ params }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const post = yield* dieOnDatabaseError(
          svc
            .getBySlug(params.slug)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )

        return toDateStrings(post)
      })
    )
    .handle('getPostBySlugForEdit', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const svc = yield* PostService
        const post = yield* dieOnDatabaseError(
          svc.getBySlugForEdit(params.slug, user.id, user.role ?? 'user').pipe(
            Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
            Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized())
          )
        )
        return toDateStrings(post)
      })
    )
    .handle('createPost', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        if (!canCreatePosts(user.role)) {
          return yield* new HttpApiError.Forbidden()
        }

        const { creatorIds, ...postData } = payload
        const finalCreatorIds = creatorIds?.length ? [...creatorIds] : [user.id]

        const svc = yield* PostService
        const post = yield* dieOnDatabaseError(
          svc
            .create(
              { ...postData, tags: postData.tags ? [...postData.tags] : undefined },
              finalCreatorIds
            )
            .pipe(
              Effect.catchTag('ConflictError', () => new HttpApiError.Conflict()),
              Effect.catchTag('ValidationError', () => new ValidationHttpError()),
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('QuotedPostNotEmbeddableError', () => new ValidationHttpError())
            )
        )

        return toDateStrings(post)
      })
    )
    .handle('updatePostBySlug', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const { tags, creatorIds, ...updateData } = payload

        const svc = yield* PostService
        const post = yield* dieOnDatabaseError(
          svc
            .update(params.slug, user.id, user.role || 'user', {
              ...updateData,
              ...(tags && { tags: [...tags] }),
              ...(creatorIds && { creatorIds: [...creatorIds] })
            })
            .pipe(
              Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()),
              Effect.catchTag('UnauthorizedError', () => new HttpApiError.Unauthorized()),
              Effect.catchTag('ValidationError', () => new ValidationHttpError())
            )
        )

        return toDateStrings(post)
      })
    )
    .handle('getPostsByTag', ({ params, query }) =>
      Effect.gen(function* () {
        const svc = yield* PostService
        const result = yield* dieOnDatabaseError(
          svc.getByTag(params.tag, { limit: query.limit ?? 20, offset: query.offset ?? 0 })
        )

        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
      })
    )
)
