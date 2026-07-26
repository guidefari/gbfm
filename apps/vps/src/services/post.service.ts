import { and, arrayContains, count, desc, eq, exists, inArray, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { user as usersTable } from '@/db/auth.schema'
import {
  type InsertPost,
  type PostType,
  postCreators,
  postsTable,
  type SelectMdxCompiledEditorialPost,
  type SelectMdxCompiledMicroPost,
  type SelectMdxCompiledPost,
  type SelectPost
} from '@/db/post.schema'
import { timeQuery } from '@/db/query-timer'
import {
  ConflictError,
  DatabaseError,
  getErrorMessage,
  NotFoundError,
  type UnauthorizedError,
  ValidationError
} from '@/errors'
import { requireCreatorOrAdmin } from '@/lib/authorization'
import { MdxService } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'
import { SentryService } from '@/services/sentry.service'

export interface PostService {
  readonly getAll: (options: {
    limit: number
    offset: number
    type?: PostType
  }) => Effect.Effect<
    { data: SelectMdxCompiledPost[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly getAllForEdit: (
    options: { limit: number; offset: number; type?: PostType },
    userId: string,
    userRole: string
  ) => Effect.Effect<
    { data: SelectMdxCompiledPost[]; pagination: PaginationMetadata },
    DatabaseError
  >
  readonly getBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledPost, DatabaseError | NotFoundError>
  readonly getBySlugForEdit: (
    slug: string,
    userId: string,
    userRole: string
  ) => Effect.Effect<SelectMdxCompiledPost, DatabaseError | NotFoundError | UnauthorizedError>
  readonly getEditorials: (options: {
    limit: number
    offset: number
    tag?: string
  }) => Effect.Effect<
    { data: SelectMdxCompiledEditorialPost[]; pagination: PaginationMetadata },
    DatabaseError,
    SentryService
  >
  readonly getEditorialBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledEditorialPost, DatabaseError | NotFoundError>
  readonly getMicroPosts: (options: {
    limit: number
    offset: number
  }) => Effect.Effect<
    { data: SelectMdxCompiledMicroPost[]; pagination: PaginationMetadata },
    DatabaseError,
    SentryService
  >
  readonly getMicroPostBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledMicroPost, DatabaseError | NotFoundError>
  readonly getEditorialTags: () => Effect.Effect<string[], DatabaseError>
  readonly getByTag: (
    tag: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<{ data: SelectPost[]; pagination: PaginationMetadata }, DatabaseError>
  readonly create: (
    data: InsertPost,
    creatorIds: string[]
  ) => Effect.Effect<SelectPost, DatabaseError | ConflictError | ValidationError>
  readonly update: (
    slug: string,
    userId: string,
    userRole: string,
    data: Partial<InsertPost> & { creatorIds?: string[] }
  ) => Effect.Effect<
    SelectMdxCompiledPost,
    DatabaseError | NotFoundError | UnauthorizedError | ValidationError
  >
}

export const PostService = Context.Service<PostService>('PostService')

const isNonBlankString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const normalizeBlankString = (value: string | null | undefined) =>
  typeof value === 'string' && value.trim().length === 0 ? null : value

export const validatePostData = (
  data: Partial<InsertPost>
): Effect.Effect<void, ValidationError> => {
  if (data.type === 'micro') {
    return isNonBlankString(data.title) || isNonBlankString(data.content)
      ? Effect.void
      : Effect.fail(new ValidationError({ message: 'Tweet title or body is required' }))
  }

  if (!isNonBlankString(data.title)) {
    return Effect.fail(new ValidationError({ message: 'Post title is required' }))
  }

  if (!isNonBlankString(data.content)) {
    return Effect.fail(new ValidationError({ message: 'Post content is required' }))
  }

  return Effect.void
}

export function normalizePostData(data: InsertPost, type: PostType | null | undefined): InsertPost
export function normalizePostData(
  data: Partial<InsertPost>,
  type: PostType | null | undefined
): Partial<InsertPost>
export function normalizePostData(
  data: Partial<InsertPost>,
  type: PostType | null | undefined
): Partial<InsertPost> {
  if (type !== 'micro') {
    return data
  }

  const normalizedData = { ...data }

  if ('title' in normalizedData) {
    normalizedData.title = normalizeBlankString(normalizedData.title)
  }

  if ('content' in normalizedData) {
    normalizedData.content = normalizeBlankString(normalizedData.content)
  }

  return normalizedData
}

const buildPostWithCreators = (post: SelectPost, mdx: MdxService) =>
  Effect.gen(function* () {
    const creators = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            username: usersTable.username
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
    }).pipe(Effect.withSpan('post.getCreators', { attributes: { postId: post.id } }))

    return yield* buildPostWithPreloadedCreators(post, creators, mdx)
  })

const buildPostWithPreloadedCreators = (
  post: SelectPost,
  creators: Array<{ id: string; name: string; username: string | null }>,
  mdx: MdxService
) =>
  Effect.gen(function* () {
    let compiledContent = ''

    if (post.content) {
      compiledContent = yield* mdx.compile(post.content).pipe(Effect.orElseSucceed(() => ''))
    }

    return {
      ...post,
      compiledContent,
      creators
    } satisfies SelectMdxCompiledPost
  })

export const toEditorialPost = (
  post: SelectMdxCompiledPost
): Effect.Effect<SelectMdxCompiledEditorialPost, DatabaseError> =>
  Effect.gen(function* () {
    const { title, content } = post

    if (post.type === 'post' && isNonBlankString(title) && isNonBlankString(content)) {
      return {
        ...post,
        title,
        content,
        type: 'post' as const
      }
    }

    return yield* new DatabaseError({
      message: `Expected editorial post with title and content: ${post.slug}`,
      operation: 'post_type_refinement',
      table: 'posts'
    })
  })

export const toMicroPost = (
  post: SelectMdxCompiledPost
): Effect.Effect<SelectMdxCompiledMicroPost, DatabaseError> =>
  post.type === 'micro'
    ? Effect.succeed({ ...post, type: 'micro' })
    : Effect.fail(
        new DatabaseError({
          message: `Expected micro post: ${post.slug}`,
          operation: 'post_type_refinement',
          table: 'posts'
        })
      )

const getAllEffect = (
  options: { limit: number; offset: number; type?: PostType; tag?: string },
  mdx: MdxService,
  actor?: { userId: string; userRole: string }
) =>
  Effect.gen(function* () {
    const { limit, offset, type, tag } = options
    const contentCondition =
      type && tag
        ? and(eq(postsTable.type, type), arrayContains(postsTable.tags, [tag]))
        : type
          ? eq(postsTable.type, type)
          : tag
            ? arrayContains(postsTable.tags, [tag])
            : undefined
    const visibilityCondition = actor
      ? actor.userRole === 'admin'
        ? undefined
        : exists(
            db
              .select({ id: postCreators.postId })
              .from(postCreators)
              .where(
                and(
                  eq(postCreators.postId, postsTable.id),
                  eq(postCreators.creatorId, actor.userId)
                )
              )
          )
      : eq(postsTable.draft, false)
    const whereCondition = and(visibilityCondition, contentCondition)

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () => db.select({ total: count() }).from(postsTable).where(whereCondition),
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

    const postIds = data.map((p) => p.id)

    const creatorsData =
      postIds.length > 0
        ? yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  postId: postCreators.postId,
                  creatorId: usersTable.id,
                  creatorName: usersTable.name,
                  creatorUsername: usersTable.username
                })
                .from(postCreators)
                .innerJoin(usersTable, eq(postCreators.creatorId, usersTable.id))
                .where(inArray(postCreators.postId, postIds)),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to fetch creators: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'post_creators'
              })
          }).pipe(
            Effect.withSpan('post.getAll.creators', { attributes: { postCount: postIds.length } })
          )
        : []

    const creatorsByPostId: Record<
      string,
      Array<{ id: string; name: string; username: string | null }>
    > = {}
    for (const row of creatorsData) {
      const existing = creatorsByPostId[row.postId]
      const creator = {
        id: row.creatorId,
        name: row.creatorName,
        username: row.creatorUsername
      }
      if (existing) {
        existing.push(creator)
      } else {
        creatorsByPostId[row.postId] = [creator]
      }
    }

    const compiledData: SelectMdxCompiledPost[] = yield* Effect.forEach(
      data,
      (post) => {
        const creators = creatorsByPostId[post.id] ?? []
        return buildPostWithPreloadedCreators(post, creators, mdx)
      },
      { concurrency: 5 }
    )

    return {
      data: compiledData,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  }).pipe(
    Effect.withSpan('post.getAll', {
      attributes: { 'post.type': options.type ?? 'all' }
    })
  )

const getEditorialTagsEffect = () =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .selectDistinct({
            tag: sql<string | null>`unnest(${postsTable.tags})`
          })
          .from(postsTable)
          .where(and(eq(postsTable.type, 'post'), eq(postsTable.draft, false))),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch editorial tags: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    return rows
      .map((r) => r.tag)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .toSorted()
  })

const getEditorialsEffect = (
  options: { limit: number; offset: number; tag?: string },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const posts = yield* getAllEffect({ ...options, type: 'post' }, mdx)
    const sentry = yield* SentryService
    const rawData = yield* Effect.forEach(
      posts.data,
      (post) =>
        toEditorialPost(post).pipe(
          Effect.catchTag('DatabaseError', (e) =>
            Effect.andThen(
              sentry.captureException(e, {
                slug: post.slug,
                type: post.type,
                operation: 'toEditorialPost'
              }),
              Effect.succeed<SelectMdxCompiledEditorialPost | null>(null)
            )
          )
        ),
      { concurrency: 5 }
    )
    const data = rawData.filter((p): p is SelectMdxCompiledEditorialPost => p !== null)

    return {
      ...posts,
      data
    }
  }).pipe(Effect.withSpan('post.getEditorials'))

const getMicroPostsEffect = (options: { limit: number; offset: number }, mdx: MdxService) =>
  Effect.gen(function* () {
    const posts = yield* getAllEffect({ ...options, type: 'micro' }, mdx)
    const sentry = yield* SentryService
    const rawData = yield* Effect.forEach(
      posts.data,
      (post) =>
        toMicroPost(post).pipe(
          Effect.catchTag('DatabaseError', (e) =>
            Effect.andThen(
              sentry.captureException(e, {
                slug: post.slug,
                type: post.type,
                operation: 'toMicroPost'
              }),
              Effect.succeed<SelectMdxCompiledMicroPost | null>(null)
            )
          )
        ),
      { concurrency: 5 }
    )
    const data = rawData.filter((p): p is SelectMdxCompiledMicroPost => p !== null)

    return {
      ...posts,
      data
    }
  }).pipe(Effect.withSpan('post.getMicroPosts'))

const getByTagEffect = (tag: string, options: { limit: number; offset: number }) =>
  Effect.gen(function* () {
    const { limit, offset } = options
    const whereCondition = and(eq(postsTable.draft, false), arrayContains(postsTable.tags, [tag]))

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () => db.select({ total: count() }).from(postsTable).where(whereCondition),
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

const getBySlugEffect = (slug: string, mdx: MdxService, includeDrafts = false) =>
  Effect.gen(function* () {
    const postRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(postsTable)
          .where(
            includeDrafts
              ? eq(postsTable.slug, slug)
              : and(eq(postsTable.slug, slug), eq(postsTable.draft, false))
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    }).pipe(Effect.withSpan('post.getBySlug.query', { attributes: { slug } }))

    const post = postRecords[0]
    if (!post) {
      return yield* new NotFoundError({
        message: 'Post not found',
        resource: 'post',
        id: slug
      })
    }

    const processedPost = yield* buildPostWithCreators(post, mdx)

    yield* Effect.annotateCurrentSpan('slug', slug)

    yield* Effect.logInfo('[Content] Post retrieved by slug', {
      slug,
      postId: post.id
    })

    return processedPost
  }).pipe(Effect.withSpan('post.getBySlug', { attributes: { slug } }))

const getEditorialBySlugEffect = (slug: string, mdx: MdxService) =>
  Effect.gen(function* () {
    const post = yield* getBySlugEffect(slug, mdx)
    return yield* toEditorialPost(post).pipe(
      Effect.mapError(
        () =>
          new NotFoundError({
            message: 'Editorial post not found',
            resource: 'post',
            id: slug
          })
      )
    )
  }).pipe(
    Effect.withSpan('post.getEditorialBySlug', {
      attributes: { 'post.slug': slug }
    })
  )

const getMicroPostBySlugEffect = (slug: string, mdx: MdxService) =>
  Effect.gen(function* () {
    const post = yield* getBySlugEffect(slug, mdx)
    return yield* toMicroPost(post).pipe(
      Effect.mapError(
        () =>
          new NotFoundError({
            message: 'Micro post not found',
            resource: 'post',
            id: slug
          })
      )
    )
  }).pipe(
    Effect.withSpan('post.getMicroPostBySlug', {
      attributes: { 'post.slug': slug }
    })
  )

const createEffect = (data: InsertPost, creatorIds: string[]) =>
  Effect.gen(function* () {
    const normalizedData = normalizePostData(data, data.type)
    yield* validatePostData(normalizedData)

    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const [newPost] = await tx.insert(postsTable).values(normalizedData).returning()

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

const updateEffect = (
  slug: string,
  userId: string,
  userRole: string,
  data: Partial<InsertPost> & { creatorIds?: string[] },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const existingRecords = yield* Effect.tryPromise({
      try: () => db.select().from(postsTable).where(eq(postsTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to check post existence: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const existingPost = existingRecords[0]
    if (!existingPost) {
      return yield* new NotFoundError({
        message: 'Post not found',
        resource: 'post',
        id: slug
      })
    }

    yield* requireCreatorOrAdmin('post', existingPost.id, userId, userRole)

    const nextPostData = { ...existingPost, ...data }
    const normalizedNextPostData = normalizePostData(nextPostData, nextPostData.type)
    yield* validatePostData(normalizedNextPostData)

    const { creatorIds, ...updateData } = data
    const normalizedUpdateData = normalizePostData(updateData, nextPostData.type)
    let updatedPost = existingPost

    if (Object.keys(normalizedUpdateData).length > 0) {
      const updatedRecords = yield* Effect.tryPromise({
        try: () =>
          db
            .update(postsTable)
            .set({ ...normalizedUpdateData, updatedAt: new Date() })
            .where(eq(postsTable.id, existingPost.id))
            .returning(),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update post: ${getErrorMessage(error)}`,
            operation: 'update',
            table: 'posts'
          })
      })

      if (!updatedRecords[0]) {
        return yield* new DatabaseError({
          message: 'Failed to update post',
          operation: 'update',
          table: 'posts'
        })
      }
      updatedPost = updatedRecords[0]
    }

    if (creatorIds && creatorIds.length > 0) {
      yield* Effect.tryPromise({
        try: async () => {
          await db.delete(postCreators).where(eq(postCreators.postId, updatedPost.id))
          await db.insert(postCreators).values(
            creatorIds.map((creatorId) => ({
              postId: updatedPost.id,
              creatorId
            }))
          )
        },
        catch: (error) =>
          new DatabaseError({
            message: `Failed to update creators: ${getErrorMessage(error)}`,
            operation: 'update',
            table: 'post_creators'
          })
      })
    }

    return yield* buildPostWithCreators(updatedPost, mdx)
  })

export const PostServiceLayer = Layer.effect(
  PostService,
  Effect.gen(function* () {
    const mdx = yield* MdxService
    return {
      getAll: (opts) => getAllEffect(opts, mdx),
      getAllForEdit: (opts, userId, userRole) => getAllEffect(opts, mdx, { userId, userRole }),
      getBySlug: (slug) => getBySlugEffect(slug, mdx),
      getBySlugForEdit: (slug, userId, userRole) =>
        Effect.gen(function* () {
          const post = yield* getBySlugEffect(slug, mdx, true)
          yield* requireCreatorOrAdmin('post', post.id, userId, userRole)
          return post
        }),
      getEditorials: (opts) => getEditorialsEffect(opts, mdx),
      getEditorialBySlug: (slug) => getEditorialBySlugEffect(slug, mdx),
      getMicroPosts: (opts) => getMicroPostsEffect(opts, mdx),
      getMicroPostBySlug: (slug) => getMicroPostBySlugEffect(slug, mdx),
      getEditorialTags: getEditorialTagsEffect,
      getByTag: getByTagEffect,
      create: createEffect,
      update: (slug, userId, userRole, data) => updateEffect(slug, userId, userRole, data, mdx)
    }
  })
)
