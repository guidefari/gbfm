import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import {
  GetEditorialPostsResponse,
  GetEditorialTagsResponse,
  ValidationHttpError
} from '@gbfm/api/post'
import { Effect, Schema } from 'effect'
import { HttpServerResponse } from 'effect/unstable/http'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { PostService } from '@/services/post.service'

const dieOnDatabaseError = makeDieOnDatabaseError('post')

const toDateStrings = <T extends { createdAt: Date; updatedAt: Date }>(post: T) => ({
  ...post,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString()
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
          svc.getMicroPosts({ limit: query.limit ?? 20, offset: query.offset ?? 0 })
        )

        return {
          data: result.data.map(toDateStrings),
          pagination: result.pagination
        }
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
    .handle('createPost', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
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
              Effect.catchTag('ValidationError', () => new ValidationHttpError())
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
