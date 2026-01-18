import { arrayContains, count, desc } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import {
  type InsertPost,
  postCreators,
  postsTable,
  type SelectPost
} from '@/db/post.schema'
import { timeQuery } from '@/db/query-timer'
import { ConflictError, DatabaseError } from '@/errors'
import {
  createPaginationMetadata,
  type PaginationMetadata
} from '@/lib/pagination'

export interface PostService {
  readonly getByTag: (
    tag: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<
    { data: SelectPost[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly create: (
    data: InsertPost,
    creatorIds: string[]
  ) => Effect.Effect<SelectPost, DatabaseError | ConflictError>
}

export const PostService = Context.GenericTag<PostService>('PostService')

const getByTagEffect = (
  tag: string,
  options: { limit: number; offset: number }
) =>
  Effect.gen(function* () {
    const { limit, offset } = options
    const whereCondition = arrayContains(postsTable.tags, [tag])

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db
              .select({ total: count() })
              .from(postsTable)
              .where(whereCondition),
          'get-posts-by-tag-count'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count posts: ${(error as Error).message}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const total = countResult[0]?.total ?? 0

    const data = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db
              .select()
              .from(postsTable)
              .where(whereCondition)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(postsTable.createdAt)),
          'get-posts-by-tag-data'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch posts: ${(error as Error).message}`,
          operation: 'select',
          table: 'posts'
        })
    })

    yield* Effect.logInfo('[Content] Posts retrieved by tag', {
      tag,
      count: data.length,
      total,
      limit,
      offset
    })

    return {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const createEffect = (data: InsertPost, creatorIds: string[]) =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const [newPost] = await tx.insert(postsTable).values(data).returning()

          if (!newPost) {
            throw new Error('Failed to create post')
          }

          await tx.insert(postCreators).values(
            creatorIds.map((creatorId) => ({
              postId: newPost.id,
              creatorId
            }))
          )

          return newPost
        }),
      catch: (error) => {
        const errorMessage = (error as Error).message
        if (errorMessage.includes('unique constraint')) {
          return new ConflictError({
            message: 'Post with this slug already exists',
            resource: 'post'
          })
        }
        if (errorMessage.includes('foreign key constraint')) {
          return new ConflictError({
            message: 'You may have entered a non-existent creator id',
            resource: 'post'
          })
        }
        return new DatabaseError({
          message: `Failed to create post: ${errorMessage}`,
          operation: 'transaction',
          table: 'posts'
        })
      }
    })

    yield* Effect.logInfo('[Content] Post created', {
      postId: result.id,
      title: result.title,
      slug: result.slug,
      type: result.type,
      creatorCount: creatorIds.length,
      tags: result.tags
    })

    return result
  })

export const PostServiceLive = Layer.succeed(PostService, {
  getByTag: getByTagEffect,
  create: createEffect
})
