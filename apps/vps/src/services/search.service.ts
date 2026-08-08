import { and, type Column, eq, ilike, or, sql } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { Database } from '@/db/layer'
import { audioTable } from '@/db/audio.schema'
import { postsTable } from '@/db/post.schema'
import { showsTable } from '@/db/show.schema'
import { DatabaseError, getErrorMessage } from '@/errors'

const tagMatches = (tags: Column, pattern: string) =>
  sql`EXISTS (SELECT 1 FROM unnest(${tags}) AS t WHERE t ILIKE ${pattern})`

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

const searchEffect = (db: Database['Service'], query: string, limit: number) =>
  Effect.gen(function* () {
    const pattern = `%${query}%`

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
          .where(
            and(
              eq(showsTable.draft, false),
              or(
                ilike(showsTable.title, pattern),
                ilike(showsTable.description, pattern),
                ilike(showsTable.content, pattern),
                tagMatches(showsTable.tags, pattern)
              )
            )
          )
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
          where: and(
            eq(audioTable.draft, false),
            or(
              ilike(audioTable.title, pattern),
              ilike(audioTable.description, pattern),
              ilike(audioTable.content, pattern),
              tagMatches(audioTable.tags, pattern)
            )
          ),
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
          .where(
            and(
              eq(postsTable.draft, false),
              or(
                ilike(postsTable.title, pattern),
                ilike(postsTable.description, pattern),
                ilike(postsTable.content, pattern),
                tagMatches(postsTable.tags, pattern)
              )
            )
          )
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
    return {
      search: (query, limit) =>
        searchEffect(db, query, limit).pipe(
          Effect.withSpan('search.search', { attributes: { query } })
        )
    }
  })
)
