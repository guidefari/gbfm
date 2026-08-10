import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  like,
  lte,
  ne,
  notInArray,
  or,
  sql
} from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { Database } from '@/db/layer'
import {
  hasEntityLabel,
  hasEntityLabelLike,
  projectEntityLabels,
  projectEntityLabelsForRows,
  replaceEntityLabels
} from '@/db/labels'
import { entityLabelsTable, labelsTable } from '@/db/tags.schema'
import {
  musicAlbumsTable,
  musicPlaylistTracksTable,
  musicPlaylistsTable,
  musicTracksTable
} from '@/db/music-entity.schema'
import { postIdsForCreator } from '@/db/creator-membership'
import { blueskyPostSources } from '@/db/external-account.schema'
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
  QuotedPostNotEmbeddableError,
  type UnauthorizedError,
  ValidationError
} from '@/errors'
import { checkCreatorAuthorship, requireCreatorOrAdmin } from '@/lib/authorization'
import { MdxService } from '@/lib/mdx'
import { createPaginationMetadata, type PaginationMetadata } from '@/lib/pagination'
import { ConfigService } from '@/services/config.service'
import { SentryService } from '@/services/sentry.service'
import { toSlug } from '@/services/to-slug'
import { markAttachedAssets, UploadAssetService } from '@/services/upload-asset.service'

export const POST_SOURCE_FILTERS = ['bluesky', 'native'] as const
export type PostSourceFilter = (typeof POST_SOURCE_FILTERS)[number]

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
    options: {
      limit: number
      offset: number
      type?: PostType
      source?: PostSourceFilter
      draft?: boolean
      q?: string
    },
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
  readonly getMicroPostReferenceBySlug: (
    slug: string
  ) => Effect.Effect<{ readonly id: string; readonly slug: string }, DatabaseError | NotFoundError>
  readonly getMicroPostById: (
    id: string
  ) => Effect.Effect<SelectMdxCompiledMicroPost, DatabaseError | NotFoundError>
  readonly getEditorialTags: () => Effect.Effect<string[], DatabaseError>
  readonly getMicroTags: () => Effect.Effect<string[], DatabaseError>
  readonly getAdjacentMicroPosts: (slug: string) => Effect.Effect<
    {
      prev: { id: string; slug: string; title: string | null } | null
      next: { id: string; slug: string; title: string | null } | null
    },
    DatabaseError | NotFoundError
  >
  readonly getRandomMicroPost: (
    excludeSlugs: string[]
  ) => Effect.Effect<{ id: string; slug: string }, DatabaseError | NotFoundError>
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
    data: Partial<InsertPost>,
    creatorIds: string[]
  ) => Effect.Effect<
    SelectPost,
    DatabaseError | ConflictError | ValidationError | NotFoundError | QuotedPostNotEmbeddableError
  >
  readonly createMicroPostReply: (options: {
    parentSlug: string
    actorUserId: string
    title?: string | null
    content?: string | null
    musicEntityType?: string | null
    musicEntityId?: string | null
    quotedPostId?: string | null
  }) => Effect.Effect<
    SelectMdxCompiledMicroPost,
    | DatabaseError
    | NotFoundError
    | ConflictError
    | ValidationError
    | ParentPostNotReplyableError
    | QuotedPostNotEmbeddableError
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

type PostRow = Omit<SelectPost, 'tags'> & { tags?: string[] | null }

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

const buildPostWithCreators = (post: PostRow, mdx: MdxService) =>
  Effect.gen(function* () {
    const db = yield* Database
    const { blueskySources, creators, projectedPost } = yield* Effect.all({
      blueskySources: Effect.tryPromise({
        try: () =>
          db
            .select({
              authorDid: blueskyPostSources.authorDid,
              authorHandle: blueskyPostSources.authorHandle,
              publicUrl: blueskyPostSources.publicUrl,
              sourceCreatedAt: blueskyPostSources.sourceCreatedAt,
              sourceStatus: blueskyPostSources.sourceStatus,
              locallyEdited: blueskyPostSources.locallyEdited,
              lastError: blueskyPostSources.lastError
            })
            .from(blueskyPostSources)
            .where(eq(blueskyPostSources.postId, post.id))
            .limit(1),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to fetch Bluesky source: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'bluesky_post_sources'
          })
      }),
      creators: Effect.tryPromise({
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
      }).pipe(Effect.withSpan('post.getCreators', { attributes: { postId: post.id } })),
      projectedPost: Effect.tryPromise({
        try: () => projectEntityLabels(db, 'post', post),
        catch: (error) =>
          new DatabaseError({
            message: getErrorMessage(error),
            operation: 'select',
            table: 'labels'
          })
      })
    })
    const compiledContent = projectedPost.content
      ? yield* mdx.compile(projectedPost.content).pipe(Effect.orElseSucceed(() => ''))
      : ''
    const compiled = {
      ...projectedPost,
      compiledContent,
      creators
    } satisfies SelectMdxCompiledPost
    const blueskySource = blueskySources[0]
    return blueskySource ? { ...compiled, blueskySource } : compiled
  })

const buildPostWithPreloadedCreators = (
  post: PostRow,
  creators: Array<{ id: string; name: string; username: string | null }>,
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const projectedPost = yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'post', post),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
    const compiledContent = projectedPost.content
      ? yield* mdx.compile(projectedPost.content).pipe(Effect.orElseSucceed(() => ''))
      : ''

    return {
      ...projectedPost,
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

export const importedPostIds = (db: Database['Service']) =>
  db
    .select({ postId: blueskyPostSources.postId })
    .from(blueskyPostSources)
    .where(sql`${blueskyPostSources.postId} is not null`)

const getAllEffect = (
  options: {
    limit: number
    offset: number
    type?: PostType
    tag?: string
    topLevelOnly?: boolean
    source?: PostSourceFilter
    draft?: boolean
    q?: string
  },
  mdx: MdxService,
  actor?: { userId: string; userRole: string }
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const { limit, offset, type, tag, topLevelOnly, source, draft, q } = options
    const contentCondition =
      type && tag
        ? and(eq(postsTable.type, type), hasEntityLabel('post', postsTable.id, tag))
        : type
          ? eq(postsTable.type, type)
          : tag
            ? hasEntityLabel('post', postsTable.id, tag)
            : undefined
    const visibilityCondition = actor
      ? actor.userRole === 'admin'
        ? undefined
        : postIdsForCreator(db, actor.userId)
      : eq(postsTable.draft, false)
    const replyCondition = topLevelOnly ? isNull(postsTable.parentPostId) : undefined
    const sourceCondition =
      source === 'bluesky'
        ? inArray(postsTable.id, importedPostIds(db))
        : source === 'native'
          ? notInArray(postsTable.id, importedPostIds(db))
          : undefined
    const draftCondition = draft === undefined ? undefined : eq(postsTable.draft, draft)
    const searchTerm = q?.trim()
    const searchCondition = searchTerm
      ? sql`(lower(${postsTable.title}) LIKE ${`%${searchTerm.toLowerCase()}%`} OR lower(${postsTable.slug}) LIKE ${`%${searchTerm.toLowerCase()}%`} OR lower(${postsTable.content}) LIKE ${`%${searchTerm.toLowerCase()}%`})`
      : undefined
    const whereCondition = and(
      visibilityCondition,
      contentCondition,
      replyCondition,
      sourceCondition,
      draftCondition,
      searchCondition
    )

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

    const sourcesData =
      postIds.length > 0
        ? yield* Effect.tryPromise({
            try: () =>
              db
                .select({
                  postId: blueskyPostSources.postId,
                  authorDid: blueskyPostSources.authorDid,
                  authorHandle: blueskyPostSources.authorHandle,
                  publicUrl: blueskyPostSources.publicUrl,
                  sourceCreatedAt: blueskyPostSources.sourceCreatedAt,
                  sourceStatus: blueskyPostSources.sourceStatus,
                  locallyEdited: blueskyPostSources.locallyEdited,
                  lastError: blueskyPostSources.lastError
                })
                .from(blueskyPostSources)
                .where(inArray(blueskyPostSources.postId, postIds)),
            catch: (error) =>
              new DatabaseError({
                message: `Failed to fetch Bluesky sources: ${getErrorMessage(error)}`,
                operation: 'select',
                table: 'bluesky_post_sources'
              })
          })
        : []

    const sourceByPostId = new Map(
      sourcesData.flatMap(({ postId, ...source }) => (postId ? [[postId, source] as const] : []))
    )

    const projectedData = yield* Effect.tryPromise({
      try: () => projectEntityLabelsForRows(db, 'post', data),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
    const compiledData: SelectMdxCompiledPost[] = yield* Effect.forEach(
      projectedData,
      (post) => {
        const creators = creatorsByPostId[post.id] ?? []
        const blueskySource = sourceByPostId.get(post.id)
        return buildPostWithPreloadedCreators(post, creators, mdx).pipe(
          Effect.map((compiled) => (blueskySource ? { ...compiled, blueskySource } : compiled))
        )
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
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .selectDistinct({ tag: labelsTable.name })
          .from(postsTable)
          .innerJoin(
            entityLabelsTable,
            and(
              eq(entityLabelsTable.entityType, 'post'),
              eq(entityLabelsTable.entityId, postsTable.id)
            )
          )
          .innerJoin(
            labelsTable,
            and(eq(labelsTable.id, entityLabelsTable.labelId), eq(labelsTable.kind, 'tag'))
          )
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
      .filter((tag) => tag.length > 0)
      .toSorted()
  })

const getMicroTagsEffect = () =>
  Effect.gen(function* () {
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .selectDistinct({ tag: labelsTable.name })
          .from(postsTable)
          .innerJoin(
            entityLabelsTable,
            and(
              eq(entityLabelsTable.entityType, 'post'),
              eq(entityLabelsTable.entityId, postsTable.id)
            )
          )
          .innerJoin(
            labelsTable,
            and(eq(labelsTable.id, entityLabelsTable.labelId), eq(labelsTable.kind, 'tag'))
          )
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
      .filter((tag) => tag.length > 0)
      .toSorted()
  })

const getAdjacentMicroPostsEffect = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Database
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
      isNull(postsTable.parentPostId),
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
    const { prevRows, nextRows } = yield* Effect.all({
      prevRows: Effect.tryPromise({
        try: () =>
          db
            .select({ id: postsTable.id, slug: postsTable.slug, title: postsTable.title })
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
      }),
      nextRows: Effect.tryPromise({
        try: () =>
          db
            .select({ id: postsTable.id, slug: postsTable.slug, title: postsTable.title })
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
    })

    return {
      prev: prevRows[0] ?? null,
      next: nextRows[0] ?? null
    }
  }).pipe(Effect.withSpan('post.getAdjacentMicroPosts', { attributes: { slug } }))

const getRandomMicroPostEffect = (excludeSlugs: string[]) =>
  Effect.gen(function* () {
    const db = yield* Database
    const baseCondition = and(
      eq(postsTable.type, 'micro'),
      eq(postsTable.draft, false),
      isNull(postsTable.parentPostId)
    )
    const withExclude =
      excludeSlugs.length > 0
        ? and(baseCondition, notInArray(postsTable.slug, excludeSlugs))
        : baseCondition

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: postsTable.id, slug: postsTable.slug })
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
          .select({ id: postsTable.id, slug: postsTable.slug })
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
    const db = yield* Database
    const { q, limit, offset } = options
    const pattern = `%${q.toLowerCase()}%`
    const directPostMatch =
      q.length < 3
        ? or(
            like(sql`lower(${postsTable.title})`, pattern),
            like(sql`lower(${postsTable.content})`, pattern),
            hasEntityLabelLike('post', postsTable.id, pattern)
          )
        : sql`rowid IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH ${`"${q.replaceAll('"', '""')}"`})`
    const matchCondition = or(
      directPostMatch,
      and(
        eq(postsTable.musicEntityType, 'track'),
        exists(
          db
            .select({ id: musicTracksTable.id })
            .from(musicTracksTable)
            .leftJoin(musicAlbumsTable, eq(musicAlbumsTable.id, musicTracksTable.albumId))
            .where(
              and(
                eq(musicTracksTable.id, postsTable.musicEntityId),
                or(
                  like(sql`lower(${musicTracksTable.title})`, pattern),
                  like(sql`lower(${musicTracksTable.artistNames})`, pattern),
                  like(sql`lower(${musicAlbumsTable.title})`, pattern)
                )
              )
            )
        )
      ),
      and(
        eq(postsTable.musicEntityType, 'album'),
        exists(
          db
            .select({ id: musicAlbumsTable.id })
            .from(musicAlbumsTable)
            .where(
              and(
                eq(musicAlbumsTable.id, postsTable.musicEntityId),
                or(
                  like(sql`lower(${musicAlbumsTable.title})`, pattern),
                  like(sql`lower(${musicAlbumsTable.artistNames})`, pattern)
                )
              )
            )
        )
      ),
      and(
        eq(postsTable.musicEntityType, 'playlist'),
        exists(
          db
            .select({ id: musicPlaylistsTable.id })
            .from(musicPlaylistsTable)
            .where(
              and(
                eq(musicPlaylistsTable.id, postsTable.musicEntityId),
                or(
                  like(sql`lower(${musicPlaylistsTable.title})`, pattern),
                  like(sql`lower(${musicPlaylistsTable.description})`, pattern),
                  exists(
                    db
                      .select({ trackId: musicPlaylistTracksTable.trackId })
                      .from(musicPlaylistTracksTable)
                      .innerJoin(
                        musicTracksTable,
                        eq(musicTracksTable.id, musicPlaylistTracksTable.trackId)
                      )
                      .where(
                        and(
                          eq(musicPlaylistTracksTable.playlistId, musicPlaylistsTable.id),
                          or(
                            like(sql`lower(${musicTracksTable.title})`, pattern),
                            like(sql`lower(${musicTracksTable.artistNames})`, pattern)
                          )
                        )
                      )
                  )
                )
              )
            )
        )
      )
    )

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
    const db = yield* Database
    const { limit, offset } = options
    const whereCondition = and(
      eq(postsTable.draft, false),
      hasEntityLabel('post', postsTable.id, tag)
    )

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

    const projectedData = yield* Effect.tryPromise({
      try: () => projectEntityLabelsForRows(db, 'post', data),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })

    return {
      data: projectedData,
      pagination: createPaginationMetadata(total, limit, offset)
    }
  })

const getBySlugEffect = (slug: string, mdx: MdxService, includeDrafts = false) =>
  Effect.gen(function* () {
    const db = yield* Database
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

const getMicroPostReferenceBySlugEffect = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: postsTable.id, slug: postsTable.slug })
          .from(postsTable)
          .where(
            and(
              eq(postsTable.slug, slug),
              eq(postsTable.type, 'micro'),
              eq(postsTable.draft, false)
            )
          )
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch micro post reference: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })
    const post = rows[0]
    if (!post) {
      return yield* new NotFoundError({
        message: 'Micro post not found',
        resource: 'post',
        id: slug
      })
    }
    return post
  }).pipe(Effect.withSpan('post.getMicroPostReferenceBySlug', { attributes: { slug } }))

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

const getMicroPostByIdEffect = (id: string, mdx: MdxService) =>
  Effect.gen(function* () {
    const db = yield* Database
    const postRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(postsTable)
          .where(and(eq(postsTable.id, id), eq(postsTable.draft, false)))
          .limit(1),
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
        id
      })
    }

    const compiled = yield* buildPostWithCreators(post, mdx)
    return yield* toMicroPost(compiled).pipe(
      Effect.mapError(
        () =>
          new NotFoundError({
            message: 'Micro post not found',
            resource: 'post',
            id
          })
      )
    )
  }).pipe(Effect.withSpan('post.getMicroPostById', { attributes: { 'post.id': id } }))

// Shared by createEffect and createMicroPostReplyEffect: quoting requires
// the referenced post to exist by id (NotFoundError otherwise) and be a
// micro post specifically (QuotedPostNotEmbeddableError otherwise) -- the
// exact same NotFoundError/type-mismatch split used for reply parents via
// ParentPostNotReplyableError, just keyed by id instead of slug.
const validateQuotedPost = (quotedPostId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const quotedRecords = yield* Effect.tryPromise({
      try: () => db.select().from(postsTable).where(eq(postsTable.id, quotedPostId)).limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to fetch quoted post: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    })

    const quoted = quotedRecords[0]
    if (!quoted) {
      return yield* new NotFoundError({
        message: 'Quoted post not found',
        resource: 'post',
        id: quotedPostId
      })
    }

    if (quoted.type !== 'micro') {
      return yield* new QuotedPostNotEmbeddableError({
        message: 'Only tweets can be quoted',
        quotedPostId,
        quotedPostType: quoted.type ?? 'unknown'
      })
    }
  })

export const generatePostSlug = (title?: string | null, content?: string | null) => {
  const source = isNonBlankString(title) ? title : isNonBlankString(content) ? content : null
  return source ? toSlug(source) : toSlug('post')
}

const createEffect = (data: Partial<InsertPost>, creatorIds: string[]) =>
  Effect.gen(function* () {
    const db = yield* Database
    const normalizedData = normalizePostData(data, data.type)
    yield* validatePostData(normalizedData)

    if (normalizedData.quotedPostId) {
      yield* validateQuotedPost(normalizedData.quotedPostId)
    }

    const { tags, ...postData } = normalizedData
    const dataWithSlug: InsertPost = {
      ...postData,
      slug: isNonBlankString(normalizedData.slug)
        ? normalizedData.slug
        : generatePostSlug(normalizedData.title, normalizedData.content)
    }
    const id = crypto.randomUUID()

    const result = yield* Effect.tryPromise({
      try: async () => {
        await db.batch([
          db.insert(postsTable).values({ ...dataWithSlug, id }),
          ...(creatorIds.length > 0
            ? [
                db
                  .insert(postCreators)
                  .values(creatorIds.map((creatorId) => ({ postId: id, creatorId })))
              ]
            : [])
        ])
        const rows = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1)
        const post = rows[0]
        if (!post) throw new Error('Failed to create post')
        if (tags !== undefined) await replaceEntityLabels(db, 'post', post.id, { tags })
        return post
      },
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
    yield* Effect.annotateCurrentSpan('tagCount', tags?.length || 0)

    yield* Effect.logInfo('[Content] Post created', {
      postId: result.id,
      title: result.title,
      slug: result.slug,
      type: result.type,
      creatorCount: creatorIds.length,
      tags
    })

    yield* markAttachedAssets('posts', result.id, [result.thumbnailUrl, result.bannerImageUrl])

    return yield* Effect.tryPromise({
      try: () => projectEntityLabels(db, 'post', result),
      catch: (error) =>
        new DatabaseError({ message: getErrorMessage(error), operation: 'select', table: 'labels' })
    })
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
    musicEntityType?: string | null
    musicEntityId?: string | null
    quotedPostId?: string | null
  },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const db = yield* Database
    const {
      parentSlug,
      actorUserId,
      title,
      content,
      musicEntityType,
      musicEntityId,
      quotedPostId
    } = options

    if (quotedPostId) {
      yield* validateQuotedPost(quotedPostId)
    }

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
      musicEntityType,
      musicEntityId,
      quotedPostId,
      ...threadFields
    }
    const id = crypto.randomUUID()

    const result = yield* Effect.tryPromise({
      try: async () => {
        await db.batch([
          db.insert(postsTable).values({ ...replyData, id }),
          db.insert(postCreators).values({ postId: id, creatorId: actorUserId })
        ])
        const rows = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1)
        const post = rows[0]
        if (!post) throw new Error('Failed to create reply')
        return post
      },
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
    const db = yield* Database
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

    const replyCountsByParentId: Record<string, number> = {}
    if (postIds.length > 0) {
      const replyCountRows = yield* Effect.tryPromise({
        try: () =>
          db
            .select({ parentPostId: postsTable.parentPostId, total: count() })
            .from(postsTable)
            .where(inArray(postsTable.parentPostId, postIds))
            .groupBy(postsTable.parentPostId),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to count nested replies: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'posts'
          })
      })
      for (const row of replyCountRows) {
        if (row.parentPostId) {
          replyCountsByParentId[row.parentPostId] = row.total
        }
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
    const filteredData = rawData
      .filter((p): p is SelectMdxCompiledMicroPost => p !== null)
      .map((post) => ({ ...post, replyCount: replyCountsByParentId[post.id] ?? 0 }))

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
    const db = yield* Database
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
    const compileRow = (post: PostRow) =>
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
  rawData: Partial<InsertPost> & { creatorIds?: string[] },
  mdx: MdxService
) =>
  Effect.gen(function* () {
    const db = yield* Database
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

    // Thread structure (parentPostId/rootPostId/depth) must never be
    // mutable via update, even though InsertPost's type allows it -- the
    // HTTP schema (UpdatePostInput) already omits these fields, but this
    // strip is defense-in-depth against a future caller that bypasses it.
    const { parentPostId: _parentPostId, rootPostId: _rootPostId, depth: _depth, ...data } = rawData

    const nextPostData = { ...existingPost, ...data }
    const normalizedNextPostData = normalizePostData(nextPostData, nextPostData.type)
    yield* validatePostData(normalizedNextPostData)

    const { creatorIds, tags, ...updateData } = data
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

    if (updatedPost.type === 'micro' && Object.keys(normalizedUpdateData).length > 0) {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(blueskyPostSources)
            .set({ locallyEdited: true, updatedAt: new Date() })
            .where(eq(blueskyPostSources.postId, updatedPost.id)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to mark Bluesky source as edited: ${getErrorMessage(error)}`,
            operation: 'update',
            table: 'bluesky_post_sources'
          })
      })
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

    if (tags !== undefined) {
      yield* Effect.tryPromise({
        try: () => replaceEntityLabels(db, 'post', updatedPost.id, { tags }),
        catch: (error) =>
          new DatabaseError({
            message: getErrorMessage(error),
            operation: 'update',
            table: 'labels'
          })
      })
    }

    return yield* buildPostWithCreators(updatedPost, mdx)
  })

export const PostServiceLayer = Layer.effect(
  PostService,
  Effect.gen(function* () {
    const db = yield* Database
    const mdx = yield* MdxService
    const config = yield* ConfigService
    const uploadAssetService = yield* UploadAssetService
    const provideDb = Effect.provideService(Database, db)
    return {
      getAll: (opts) => provideDb(getAllEffect(opts, mdx)),
      getAllForEdit: (opts, userId, userRole) =>
        provideDb(getAllEffect(opts, mdx, { userId, userRole })),
      getBySlug: (slug) => provideDb(getBySlugEffect(slug, mdx)),
      getBySlugForEdit: (slug, userId, userRole) =>
        provideDb(
          Effect.gen(function* () {
            const post = yield* getBySlugEffect(slug, mdx, true)
            yield* requireCreatorOrAdmin('post', post.id, userId, userRole)
            return post
          })
        ),
      getEditorials: (opts) => provideDb(getEditorialsEffect(opts, mdx)),
      getEditorialBySlug: (slug) => provideDb(getEditorialBySlugEffect(slug, mdx)),
      getMicroPosts: (opts) => provideDb(getMicroPostsEffect(opts, mdx)),
      getMicroPostBySlug: (slug) => provideDb(getMicroPostBySlugEffect(slug, mdx)),
      getMicroPostReferenceBySlug: (slug) => provideDb(getMicroPostReferenceBySlugEffect(slug)),
      getMicroPostById: (id) => provideDb(getMicroPostByIdEffect(id, mdx)),
      getEditorialTags: () => provideDb(getEditorialTagsEffect()),
      getMicroTags: () => provideDb(getMicroTagsEffect()),
      getAdjacentMicroPosts: (slug) => provideDb(getAdjacentMicroPostsEffect(slug)),
      getRandomMicroPost: (excludeSlugs) => provideDb(getRandomMicroPostEffect(excludeSlugs)),
      searchMicroPosts: (opts) => provideDb(searchMicroPostsEffect(opts, mdx)),
      getByTag: (tag, opts) => provideDb(getByTagEffect(tag, opts)),
      create: (data, creatorIds) =>
        provideDb(createEffect(data, creatorIds)).pipe(
          Effect.provideService(ConfigService, config),
          Effect.provideService(UploadAssetService, uploadAssetService)
        ),
      createMicroPostReply: (opts) => provideDb(createMicroPostReplyEffect(opts, mdx)),
      getMicroPostReplies: (parentSlug, opts) =>
        provideDb(getMicroPostRepliesEffect(parentSlug, opts, mdx)),
      getMicroPostThread: (slug, opts) => provideDb(getMicroPostThreadEffect(slug, opts, mdx)),
      update: (slug, userId, userRole, data) =>
        provideDb(updateEffect(slug, userId, userRole, data, mdx)).pipe(
          Effect.provideService(ConfigService, config),
          Effect.provideService(UploadAssetService, uploadAssetService)
        )
    }
  })
)
