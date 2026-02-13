import { arrayContains, count, desc, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import {
  type InsertPost,
  type PostType,
  postCreators,
  postsTable,
  type SelectMdxCompiledPost,
  type SelectPost
} from '@/db/post.schema'
import { timeQuery } from '@/db/query-timer'
import {
  ConflictError,
  DatabaseError,
  getErrorMessage,
  NotFoundError
} from '@/errors'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import {
  createPaginationMetadata,
  type PaginationMetadata
} from '@/lib/pagination'

export interface PostService {
  readonly getAll: (options: {
    limit: number
    offset: number
    type?: PostType
  }) => Effect.Effect<
    { data: SelectMdxCompiledPost[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledPost, DatabaseError | NotFoundError>
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

const getAllEffect = (options: {
  limit: number
  offset: number
  type?: PostType
}) =>
  Effect.gen(function* () {
    const { limit, offset, type } = options
    const whereCondition = type ? eq(postsTable.type, type) : undefined

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db
              .select({ total: count() })
              .from(postsTable)
              .where(whereCondition),
          'get-posts-count'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count posts: ${getErrorMessage(error)}`,
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
              .limit(limit)
              .offset(offset)
              .where(whereCondition)
              .orderBy(desc(postsTable.createdAt)),
          'get-posts-data'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch posts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    yield* Effect.annotateCurrentSpan('resultCount', data.length)
    yield* Effect.annotateCurrentSpan('totalCount', total)

    yield* Effect.logInfo('[Content] Posts retrieved', {
      count: data.length,
      total,
      limit,
      offset
    })

    const compiledData: SelectMdxCompiledPost[] = yield* Effect.forEach(
      data,
      (post) =>
        Effect.gen(function* () {
          let compiledContent = ''
          if (post.content) {
            const mdxResult = yield* Effect.tryPromise({
              try: () => compileMDX(post.content),
              catch: () => ({ error: 'compile failed' })
            })
            if (isMDXCompilationResult(mdxResult)) {
              compiledContent = mdxResult.compiled
            }
          }
          return { ...post, compiledContent }
        }),
      { concurrency: 5 }
    )

    return {
      data: compiledData,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

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
          message: `Failed to count posts: ${getErrorMessage(error)}`,
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
          message: `Failed to fetch posts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    yield* Effect.annotateCurrentSpan('tag', tag)
    yield* Effect.annotateCurrentSpan('resultCount', data.length)
    yield* Effect.annotateCurrentSpan('totalCount', total)

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

const getBySlugEffect = (slug: string) =>
  Effect.gen(function* () {
    const postRecords = yield* Effect.tryPromise({
      try: () =>
        db.select().from(postsTable).where(eq(postsTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const post = postRecords[0]
    if (!post) {
      return yield* new NotFoundError({
        message: 'Post not found',
        resource: 'post',
        id: slug
      })
    }

    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name
          })
          .from(postCreators)
          .innerJoin(usersTable, eq(postCreators.creatorId, usersTable.id))
          .where(eq(postCreators.postId, post.id)),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch creators: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'post_creators'
        })
    })

    let processedPost: SelectMdxCompiledPost = {
      ...post,
      compiledContent: '',
      creators: creators.map((creator) => ({
        id: creator.id,
        name: creator.name
      }))
    }

    if (post.content) {
      const mdxResult = yield* Effect.tryPromise({
        try: () => compileMDX(post.content),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to compile MDX: ${getErrorMessage(error)}`,
            operation: 'mdx_compile',
            table: 'posts'
          })
      })

      if (isMDXCompilationResult(mdxResult)) {
        processedPost = {
          ...processedPost,
          compiledContent: mdxResult.compiled
        }
      }
    }

    yield* Effect.annotateCurrentSpan('slug', slug)

    yield* Effect.logInfo('[Content] Post retrieved by slug', {
      slug,
      postId: post.id
    })

    return processedPost
  }).pipe(Effect.withSpan('post.getBySlug'))

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
        const errorMessage = getErrorMessage(error)
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

    yield* Effect.annotateCurrentSpan('postId', result.id)
    yield* Effect.annotateCurrentSpan('postType', result.type)
    yield* Effect.annotateCurrentSpan('creatorCount', creatorIds.length)
    yield* Effect.annotateCurrentSpan('tagCount', result.tags?.length || 0)

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
  getAll: getAllEffect,
  getBySlug: getBySlugEffect,
  getByTag: getByTagEffect,
  create: createEffect
})
