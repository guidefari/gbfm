import { and, eq, like, or, sql, type SQLWrapper } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { hasEntityLabelLike } from '@/db/labels'
import { Database } from '@/db/layer'
import { audioTable } from '@/db/audio.schema'
import { postsTable } from '@/db/post.schema'
import { showsTable } from '@/db/show.schema'
import { DatabaseError, getErrorMessage } from '@/errors'

const shortQueryMatches = (
  entityType: 'audio' | 'show' | 'post',
  query: string,
  table: { id: SQLWrapper; title: SQLWrapper; description: SQLWrapper; content: SQLWrapper }
) => {
  const pattern = `%${query.toLowerCase()}%`
  return or(
    like(sql`lower(${table.title})`, pattern),
    like(sql`lower(${table.description})`, pattern),
    like(sql`lower(${table.content})`, pattern),
    hasEntityLabelLike(entityType, table.id, pattern)
  )
}

const ftsMatches = (table: 'audio' | 'shows' | 'posts', query: string) => {
  const index = sql.raw(`${table}_fts`)
  const match = `"${query.replaceAll('"', '""')}"`
  return sql`rowid IN (SELECT rowid FROM ${index} WHERE ${index} MATCH ${match})`
}

export type SearchResultItem = {
  id: string
  title: string | null
  slug: string
  type: string
  thumbnailUrl: string | null
  description: string | null
  showSlug?: string | null
}

export type SearchResults = {
  shows: SearchResultItem[]
  audio: SearchResultItem[]
  posts: SearchResultItem[]
}

export interface SearchService {
  readonly search: (query: string, limit: number) => Effect.Effect<SearchResults, DatabaseError>
}

export const SearchService = Context.Service<SearchService>('SearchService')

const searchEffect = (query: string, limit: number) =>
  Effect.gen(function* () {
    const db = yield* Database
    const showMatches =
      query.length < 3 ? shortQueryMatches('show', query, showsTable) : ftsMatches('shows', query)
    const audioMatches =
      query.length < 3 ? shortQueryMatches('audio', query, audioTable) : ftsMatches('audio', query)
    const postMatches =
      query.length < 3 ? shortQueryMatches('post', query, postsTable) : ftsMatches('posts', query)

    const shows = Effect.tryPromise({
      try: () =>
        db
          .select({
            id: showsTable.id,
            title: showsTable.title,
            slug: showsTable.slug,
            thumbnailUrl: showsTable.thumbnailUrl,
            description: showsTable.description
          })
          .from(showsTable)
          .where(and(eq(showsTable.draft, false), showMatches))
          .limit(limit),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to search shows: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'shows'
        })
    }).pipe(Effect.map((rows) => rows.map((row) => ({ ...row, type: 'show' }))))

    const audio = Effect.tryPromise({
      try: () =>
        db.query.audioTable.findMany({
          columns: {
            id: true,
            title: true,
            slug: true,
            type: true,
            thumbnailUrl: true,
            description: true
          },
          with: {
            show: {
              columns: { thumbnailUrl: true, slug: true }
            }
          },
          where: and(eq(audioTable.draft, false), audioMatches),
          limit
        }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to search audio: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'audio'
        })
    }).pipe(
      Effect.map((rows) =>
        rows.map(({ show, ...row }) => ({
          ...row,
          thumbnailUrl: row.thumbnailUrl ?? show?.thumbnailUrl ?? null,
          showSlug: show?.slug ?? null
        }))
      )
    )

    const posts = Effect.tryPromise({
      try: () =>
        db
          .select({
            id: postsTable.id,
            title: postsTable.title,
            slug: postsTable.slug,
            type: postsTable.type,
            thumbnailUrl: postsTable.thumbnailUrl,
            description: postsTable.description
          })
          .from(postsTable)
          .where(and(eq(postsTable.draft, false), postMatches))
          .limit(limit),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to search posts: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'posts'
        })
    }).pipe(Effect.map((rows) => rows.map((row) => ({ ...row, type: row.type ?? 'post' }))))

    return yield* Effect.all({ shows, audio, posts }, { concurrency: 'unbounded' })
  })

export const SearchServiceLayer = Layer.effect(
  SearchService,
  Effect.gen(function* () {
    const db = yield* Database
    const provideDb = Effect.provideService(Database, db)
    return {
      search: (query, limit) =>
        provideDb(searchEffect(query, limit)).pipe(
          Effect.withSpan('search.search', { attributes: { query } })
        )
    }
  })
)
