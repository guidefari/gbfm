import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  sql
} from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { postIdsForCreator } from '@/db/creator-membership'
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
  ParentPostNotReplyableError,
  type UnauthorizedError,
  ValidationError
} from '@/errors'
import { checkCreatorAuthorship, requireCreatorOrAdmin } from '@/lib/authorization'
import { MdxService } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'
import { ConfigService } from '@/services/config.service'
import { SentryService } from '@/services/sentry.service'
import { markAttachedAssets, UploadAssetService } from '@/services/upload-asset.service'

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
    tag?: string
  }) => Effect.Effect<
    { data: SelectMdxCompiledMicroPost[]; pagination: PaginationMetadata },
    DatabaseError,
    SentryService
  >
  readonly getMicroPostBySlug: (
    slug: string
  ) => Effect.Effect<SelectMdxCompiledMicroPost, DatabaseError | NotFoundError>
  readonly getEditorialTags: () => Effect.Effect<string[], DatabaseError>
  readonly getMicroTags: () => Effect.Effect<string[], DatabaseError>
  readonly getAdjacentMicroPosts: (slug: string) => Effect.Effect<
    {
      prev: { slug: string; title: string | null } | null
      next: { slug: string; title: string | null } | null
    },
    DatabaseError | NotFoundError
  >
  readonly getRandomMicroPost: (
    excludeSlugs: string[]
  ) => Effect.Effect<{ slug: string }, DatabaseError | NotFoundError>
  readonly searchMicroPosts: (options: {
    q: string
    limit: number
    offset: number
  }) => Effect.Effect<
    { data: SelectMdxCompiledMicroPost[]; pagination: PaginationMetadata },
    DatabaseError,
    SentryService
  >
  readonly getByTag: (
    tag: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<{ data: SelectPost[]; pagination: PaginationMetadata }, DatabaseError>
  readonly create: (
    data: InsertPost,
    creatorIds: string[]
  ) => Effect.Effect<SelectPost, DatabaseError | ConflictError | ValidationError>
  readonly createMicroPostReply: (options: {
    parentSlug: string
    actorUserId: string
    title?: string | null
    content?: string | null
  }) => Effect.Effect<
    SelectMdxCompiledMicroPost,
    DatabaseError | NotFoundError | ConflictError | ValidationError | ParentPostNotReplyableError
  >
  readonly getMicroPostReplies: (
    parentSlug: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<
    { data: SelectMdxCompiledMicroPost[]; pagination: PaginationMetadata },
    DatabaseError | NotFoundError,
    SentryService
  >
  readonly getMicroPostThread: (
    slug: string,
    options: { limit: number; offset: number }
  ) => Effect.Effect<
    {
      root: SelectMdxCompiledMicroPost
      focus: SelectMdxCompiledMicroPost
      posts: SelectMdxCompiledMicroPost[]
      pagination: PaginationMetadata
    },
    DatabaseError | NotFoundError,
    SentryService
  >
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
  options: {
    limit: number
    offset: number
    type?: PostType
    tag?: string
    topLevelOnly?: boolean
  },
  mdx: MdxService,
  actor?: { userId: string; userRole: string }
) =>
  Effect.gen(function* () {
    const { limit, offset, type, tag, topLevelOnly } = options
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
        : postIdsForCreator(actor.userId)
      : eq(postsTable.draft, false)
    const replyCondition = topLevelOnly ? isNull(postsTable.parentPostId) : undefined
    const whereCondition = and(visibilityCondition, contentCondition, replyCondition)

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

const getMicroTagsEffect = () =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .selectDistinct({
            tag: sql<string | null>`unnest(${postsTable.tags})`
          })
          .from(postsTable)
          .where(and(eq(postsTable.type, 'micro'), eq(postsTable.draft, false))),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch micro tags: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    return rows
      .map((r) => r.tag)
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .toSorted()
  })

const getAdjacentMicroPostsEffect = (slug: string) =>
  Effect.gen(function* () {
    const currentRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: postsTable.id, createdAt: postsTable.createdAt })
          .from(postsTable)
          .where(and(eq(postsTable.slug, slug), eq(postsTable.type, 'micro')))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch micro post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const current = currentRecords[0]
    if (!current) {
      return yield* new NotFoundError({
        message: 'Micro post not found',
        resource: 'post',
        id: slug
      })
    }

    const baseCondition = and(
      eq(postsTable.type, 'micro'),
      eq(postsTable.draft, false),
      ne(postsTable.id, current.id)
    )

    // prev = newer (toward present), next = older (back in time) -- the
    // index redirects to the newest post, so "next" continuing to walk
    // backward through history is the intuitive direction from there.
    // Uses gte/lte + excludes the current row by id, rather than strict
    // gt/lt on createdAt alone: Postgres timestamps store microsecond
    // precision but JS Date only carries milliseconds, so a value read
    // out and passed back in as a query param can silently round down
    // and no longer compare equal to the row it came from.
    const prevRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ slug: postsTable.slug, title: postsTable.title })
          .from(postsTable)
          .where(and(baseCondition, gte(postsTable.createdAt, current.createdAt)))
          .orderBy(asc(postsTable.createdAt))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch previous micro post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const nextRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ slug: postsTable.slug, title: postsTable.title })
          .from(postsTable)
          .where(and(baseCondition, lte(postsTable.createdAt, current.createdAt)))
          .orderBy(desc(postsTable.createdAt))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch next micro post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    return {
      prev: prevRows[0] ?? null,
      next: nextRows[0] ?? null
    }
  }).pipe(Effect.withSpan('post.getAdjacentMicroPosts', { attributes: { slug } }))

const getRandomMicroPostEffect = (excludeSlugs: string[]) =>
  Effect.gen(function* () {
    const baseCondition = and(eq(postsTable.type, 'micro'), eq(postsTable.draft, false))
    const withExclude =
      excludeSlugs.length > 0
        ? and(baseCondition, notInArray(postsTable.slug, excludeSlugs))
        : baseCondition

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ slug: postsTable.slug })
          .from(postsTable)
          .where(withExclude)
          .orderBy(sql`random()`)
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch random micro post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    if (rows[0]) return rows[0]

    const fallback = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ slug: postsTable.slug })
          .from(postsTable)
          .where(baseCondition)
          .orderBy(sql`random()`)
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch random micro post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const fallbackPost = fallback[0]
    if (!fallbackPost) {
      return yield* new NotFoundError({
        message: 'No micro posts exist',
        resource: 'post',
        id: 'random'
      })
    }
    return fallbackPost
  }).pipe(Effect.withSpan('post.getRandomMicroPost'))

const searchMicroPostsEffect = (
  options: { q: string; limit: number; offset: number },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const { q, limit, offset } = options
    const pattern = `%${q}%`

    // Join columns below are quoted camelCase (e.g. "albumId", "artistNames")
    // rather than snake_case: these tables were defined without explicit
    // db-name strings on individual columns, so Drizzle's default naming
    // keeps the JS property name verbatim as the real Postgres column name.
    // Only posts.music_entity_id/music_entity_type and the table names
    // themselves were given explicit snake_case strings.
    const matchCondition = sql`
      (
        ${postsTable.title} ILIKE ${pattern}
        OR ${postsTable.content} ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM unnest(${postsTable.tags}) AS tag WHERE tag ILIKE ${pattern})
      )
      OR (
        ${postsTable.musicEntityType} = 'track' AND EXISTS (
          SELECT 1 FROM music_tracks t
          LEFT JOIN music_albums alb ON alb.id = t."albumId"
          WHERE t.id = ${postsTable.musicEntityId}
            AND (
              t.title ILIKE ${pattern}
              OR t."artistNames"::text ILIKE ${pattern}
              OR alb.title ILIKE ${pattern}
              OR EXISTS (
                SELECT 1 FROM music_track_artists mta
                JOIN music_artists a ON a.id = mta."artistId"
                WHERE mta."trackId" = t.id AND a.name ILIKE ${pattern}
              )
            )
        )
      )
      OR (
        ${postsTable.musicEntityType} = 'album' AND EXISTS (
          SELECT 1 FROM music_albums alb
          WHERE alb.id = ${postsTable.musicEntityId}
            AND (
              alb.title ILIKE ${pattern}
              OR alb."artistNames"::text ILIKE ${pattern}
              OR EXISTS (
                SELECT 1 FROM music_album_artists maa
                JOIN music_artists a ON a.id = maa."artistId"
                WHERE maa."albumId" = alb.id AND a.name ILIKE ${pattern}
              )
            )
        )
      )
      OR (
        ${postsTable.musicEntityType} = 'playlist' AND EXISTS (
          SELECT 1 FROM music_playlists pl
          WHERE pl.id = ${postsTable.musicEntityId}
            AND (
              pl.title ILIKE ${pattern}
              OR pl.description ILIKE ${pattern}
              OR EXISTS (
                SELECT 1 FROM music_playlist_tracks mpt
                JOIN music_tracks t2 ON t2.id = mpt."trackId"
                WHERE mpt."playlistId" = pl.id
                  AND (
                    t2.title ILIKE ${pattern}
                    OR t2."artistNames"::text ILIKE ${pattern}
                    OR EXISTS (
                      SELECT 1 FROM music_track_artists mta2
                      JOIN music_artists a2 ON a2.id = mta2."artistId"
                      WHERE mta2."trackId" = t2.id AND a2.name ILIKE ${pattern}
                    )
                  )
              )
            )
        )
      )
    `

    const whereCondition = and(
      eq(postsTable.type, 'micro'),
      eq(postsTable.draft, false),
      matchCondition
    )

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () => db.select({ total: count() }).from(postsTable).where(whereCondition),
          'search-micro-posts-count'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count micro posts: ${getErrorMessage(error)}`,
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
              .orderBy(desc(postsTable.createdAt))
              .limit(limit)
              .offset(offset),
          'search-micro-posts-data'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to search micro posts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
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
          })
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

    const compiledData = yield* Effect.forEach(
      data,
      (post) => buildPostWithPreloadedCreators(post, creatorsByPostId[post.id] ?? [], mdx),
      { concurrency: 5 }
    )

    const sentry = yield* SentryService
    const rawData = yield* Effect.forEach(
      compiledData,
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
    const filteredData = rawData.filter((p): p is SelectMdxCompiledMicroPost => p !== null)

    return {
      data: filteredData,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  }).pipe(Effect.withSpan('post.searchMicroPosts', { attributes: { q: options.q } }))

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

const getMicroPostsEffect = (
  options: { limit: number; offset: number; tag?: string },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const posts = yield* getAllEffect({ ...options, type: 'micro', topLevelOnly: true }, mdx)
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

    yield* markAttachedAssets('posts', result.id, [result.thumbnailUrl, result.bannerImageUrl])

    return result
  })

export const deriveReplyThreadFields = (parent: {
  id: string
  rootPostId: string | null
  depth: number
}) => ({
  parentPostId: parent.id,
  rootPostId: parent.rootPostId ?? parent.id,
  depth: parent.depth + 1
})

const generateReplySlug = () =>
  `reply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const createMicroPostReplyEffect = (
  options: {
    parentSlug: string
    actorUserId: string
    title?: string | null
    content?: string | null
  },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const { parentSlug, actorUserId, title, content } = options

    const parentRecords = yield* Effect.tryPromise({
      try: () => db.select().from(postsTable).where(eq(postsTable.slug, parentSlug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch parent post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const parent = parentRecords[0]
    if (!parent) {
      return yield* new NotFoundError({
        message: 'Parent post not found',
        resource: 'post',
        id: parentSlug
      })
    }

    // Matches getBySlugEffect's public-read visibility policy: a draft is
    // invisible to non-creators, so replying to one fails the same way an
    // ordinary read would (NotFoundError), rather than leaking its existence.
    if (parent.draft) {
      const isCreator = yield* checkCreatorAuthorship('post', parent.id, actorUserId)
      if (!isCreator) {
        return yield* new NotFoundError({
          message: 'Parent post not found',
          resource: 'post',
          id: parentSlug
        })
      }
    }

    if (parent.type !== 'micro') {
      return yield* new ParentPostNotReplyableError({
        message: 'Replies can only be created on tweets',
        parentSlug,
        parentType: parent.type ?? 'unknown'
      })
    }

    const threadFields = deriveReplyThreadFields(parent)

    const normalizedData = normalizePostData(
      { title, content, type: 'micro' as const },
      'micro' as const
    )
    yield* validatePostData(normalizedData)

    const replyData: InsertPost = {
      ...normalizedData,
      type: 'micro',
      slug: generateReplySlug(),
      ...threadFields
    }

    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const [newPost] = await tx.insert(postsTable).values(replyData).returning()

          if (!newPost) {
            throw new Error('Failed to create reply')
          }

          await tx.insert(postCreators).values({
            postId: newPost.id,
            creatorId: actorUserId
          })

          return newPost
        }),
      catch: (error) => {
        const errorMessage = getErrorMessage(error)
        if (errorMessage.includes('unique constraint')) {
          return new ConflictError({
            message: 'Reply with this slug already exists',
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
          message: `Failed to create reply: ${errorMessage}`,
          operation: 'transaction',
          table: 'posts'
        })
      }
    })

    yield* Effect.annotateCurrentSpan('postId', result.id)
    yield* Effect.annotateCurrentSpan('parentPostId', threadFields.parentPostId)
    yield* Effect.annotateCurrentSpan('rootPostId', threadFields.rootPostId)
    yield* Effect.annotateCurrentSpan('depth', threadFields.depth)

    yield* Effect.logInfo('[Content] Reply created', {
      postId: result.id,
      slug: result.slug,
      parentPostId: threadFields.parentPostId,
      rootPostId: threadFields.rootPostId,
      depth: threadFields.depth
    })

    const compiled = yield* buildPostWithCreators(result, mdx)
    return yield* toMicroPost(compiled).pipe(
      Effect.mapError(
        (error) =>
          new DatabaseError({
            message: `Reply was not created as a micro post: ${error.message}`,
            operation: 'post_type_refinement',
            table: 'posts'
          })
      )
    )
  }).pipe(
    Effect.withSpan('post.createMicroPostReply', { attributes: { parentSlug: options.parentSlug } })
  )

const getMicroPostRepliesEffect = (
  parentSlug: string,
  options: { limit: number; offset: number },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const { limit, offset } = options

    const parentRecords = yield* Effect.tryPromise({
      try: () => db.select().from(postsTable).where(eq(postsTable.slug, parentSlug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch parent post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const parent = parentRecords[0]
    if (!parent) {
      return yield* new NotFoundError({
        message: 'Parent post not found',
        resource: 'post',
        id: parentSlug
      })
    }

    const whereCondition = eq(postsTable.parentPostId, parent.id)

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () => db.select({ total: count() }).from(postsTable).where(whereCondition),
          'get-micro-post-replies-count'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count replies: ${getErrorMessage(error)}`,
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
              .orderBy(asc(postsTable.createdAt))
              .limit(limit)
              .offset(offset),
          'get-micro-post-replies-data'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch replies: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
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
          })
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

    const compiledData = yield* Effect.forEach(
      data,
      (post) => buildPostWithPreloadedCreators(post, creatorsByPostId[post.id] ?? [], mdx),
      { concurrency: 5 }
    )

    const sentry = yield* SentryService
    const rawData = yield* Effect.forEach(
      compiledData,
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
    const filteredData = rawData.filter((p): p is SelectMdxCompiledMicroPost => p !== null)

    return {
      data: filteredData,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  }).pipe(Effect.withSpan('post.getMicroPostReplies', { attributes: { parentSlug } }))

const getMicroPostThreadEffect = (
  slug: string,
  options: { limit: number; offset: number },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const { limit, offset } = options

    const focusRecords = yield* Effect.tryPromise({
      try: () => db.select().from(postsTable).where(eq(postsTable.slug, slug)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const focusRow = focusRecords[0]
    if (!focusRow) {
      return yield* new NotFoundError({
        message: 'Post not found',
        resource: 'post',
        id: slug
      })
    }

    const rootId = focusRow.rootPostId ?? focusRow.id

    const rootRow = yield* rootId === focusRow.id
      ? Effect.succeed(focusRow)
      : Effect.gen(function* () {
          const rootRecords = yield* Effect.tryPromise({
            try: () => db.select().from(postsTable).where(eq(postsTable.id, rootId)).limit(1),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to fetch root post: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'posts'
              })
          })

          const row = rootRecords[0]
          if (!row) {
            return yield* new NotFoundError({
              message: 'Root post not found',
              resource: 'post',
              id: rootId
            })
          }
          return row
        })

    const whereCondition = eq(postsTable.rootPostId, rootId)

    const countResult = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () => db.select({ total: count() }).from(postsTable).where(whereCondition),
          'get-micro-post-thread-count'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to count thread posts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const total = countResult[0]?.total ?? 0

    const descendantRows = yield* Effect.tryPromise({
      try: () =>
        timeQuery(
          () =>
            db
              .select()
              .from(postsTable)
              .where(whereCondition)
              .orderBy(asc(postsTable.createdAt))
              .limit(limit)
              .offset(offset),
          'get-micro-post-thread-data'
        ),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch thread posts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const rowsToCompile = [rootRow, focusRow, ...descendantRows]
    const postIds = rowsToCompile.map((p) => p.id)

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
          })
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

    const sentry = yield* SentryService
    const compileRow = (post: SelectPost) =>
      buildPostWithPreloadedCreators(post, creatorsByPostId[post.id] ?? [], mdx).pipe(
        Effect.flatMap((compiled) =>
          toMicroPost(compiled).pipe(
            Effect.catchTag('DatabaseError', (e) =>
              Effect.andThen(
                sentry.captureException(e, {
                  slug: compiled.slug,
                  type: compiled.type,
                  operation: 'toMicroPost'
                }),
                Effect.succeed<SelectMdxCompiledMicroPost | null>(null)
              )
            )
          )
        )
      )

    const root = yield* compileRow(rootRow)
    if (!root) {
      return yield* new DatabaseError({
        message: `Root post was not a micro post: ${rootRow.slug}`,
        operation: 'post_type_refinement',
        table: 'posts'
      })
    }

    const focus = yield* compileRow(focusRow)
    if (!focus) {
      return yield* new DatabaseError({
        message: `Focus post was not a micro post: ${focusRow.slug}`,
        operation: 'post_type_refinement',
        table: 'posts'
      })
    }

    const compiledDescendants = yield* Effect.forEach(descendantRows, compileRow, {
      concurrency: 5
    })
    const posts = compiledDescendants.filter((p): p is SelectMdxCompiledMicroPost => p !== null)

    return {
      root,
      focus,
      posts,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  }).pipe(Effect.withSpan('post.getMicroPostThread', { attributes: { slug } }))

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

      // An image attached via an edit form (not just at create time) still
      // needs its upload_assets row moved out of 'pending', or it looks
      // reclaimable to a future cleanup job despite being in use.
      yield* markAttachedAssets('posts', updatedPost.id, [
        updatedPost.thumbnailUrl,
        updatedPost.bannerImageUrl
      ])
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
    const config = yield* ConfigService
    const uploadAssetService = yield* UploadAssetService
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
      getMicroTags: getMicroTagsEffect,
      getAdjacentMicroPosts: getAdjacentMicroPostsEffect,
      getRandomMicroPost: getRandomMicroPostEffect,
      searchMicroPosts: (opts) => searchMicroPostsEffect(opts, mdx),
      getByTag: getByTagEffect,
      create: (data, creatorIds) =>
        createEffect(data, creatorIds).pipe(
          Effect.provideService(ConfigService, config),
          Effect.provideService(UploadAssetService, uploadAssetService)
        ),
      createMicroPostReply: (opts) => createMicroPostReplyEffect(opts, mdx),
      getMicroPostReplies: (parentSlug, opts) => getMicroPostRepliesEffect(parentSlug, opts, mdx),
      getMicroPostThread: (slug, opts) => getMicroPostThreadEffect(slug, opts, mdx),
      update: (slug, userId, userRole, data) =>
        updateEffect(slug, userId, userRole, data, mdx).pipe(
          Effect.provideService(ConfigService, config),
          Effect.provideService(UploadAssetService, uploadAssetService)
        )
    }
  })
)
