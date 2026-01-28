import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { audioCreators, audioTable } from '@/db/audio.schema'
import { user as userTable } from '@/db/auth.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError, NotFoundError } from '@/errors'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import { isReservedSlug } from '@/lib/reserved-slugs'

type ProfileData = {
  id: string
  displayUsername: string | null
  username: string | null
  image: string | null
  createdAt: Date
  content: {
    mixes: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
      type: 'mix' | 'track' | 'misc' | 'radio_show'
    }>
    shows: Array<{
      id: string
      title: string
      slug: string
      thumbnailUrl: string | null
    }>
  }
}

type ShowData = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  bannerImageUrl: string | null
  tags: string[] | null
  createdAt: Date
  compiledContent: string | null
  hosts: Array<{ id: string; name: string; username: string | null }>
}

export type ResolveResult =
  | { type: 'profile'; data: ProfileData }
  | { type: 'show'; data: ShowData }

export interface ResolveService {
  readonly resolve: (
    slug: string
  ) => Effect.Effect<ResolveResult, DatabaseError | NotFoundError>
}

export const ResolveService =
  Context.GenericTag<ResolveService>('ResolveService')

const resolveEffect = (slug: string) =>
  Effect.gen(function* () {
    // Check for reserved slugs first to avoid DB lookups
    if (isReservedSlug(slug)) {
      return yield* new NotFoundError({
        message: 'Not found',
        resource: 'slug',
        id: slug
      })
    }

    const userRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            displayUsername: userTable.displayUsername,
            username: userTable.username,
            image: userTable.image,
            createdAt: userTable.createdAt,
            banned: userTable.banned
          })
          .from(userTable)
          .where(eq(userTable.username, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to lookup user: ${(error as Error).message}`,
          operation: 'select',
          table: 'user'
        })
    })

    const foundUser = userRecords[0]
    if (foundUser && !foundUser.banned) {
      const userMixes = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: audioTable.id,
              title: audioTable.title,
              slug: audioTable.slug,
              thumbnailUrl: audioTable.thumbnailUrl,
              type: audioTable.type
            })
            .from(audioTable)
            .innerJoin(audioCreators, eq(audioTable.id, audioCreators.audioId))
            .where(
              and(
                eq(audioCreators.creatorId, foundUser.id),
                eq(audioTable.draft, false)
              )
            )
            .orderBy(audioTable.createdAt),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get user mixes: ${(error as Error).message}`,
            operation: 'select',
            table: 'audio'
          })
      })

      const userShows = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: showsTable.id,
              title: showsTable.title,
              slug: showsTable.slug,
              thumbnailUrl: showsTable.thumbnailUrl
            })
            .from(showsTable)
            .innerJoin(showCreators, eq(showsTable.id, showCreators.showId))
            .where(
              and(
                eq(showCreators.creatorId, foundUser.id),
                eq(showsTable.draft, false)
              )
            )
            .orderBy(showsTable.createdAt),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get user shows: ${(error as Error).message}`,
            operation: 'select',
            table: 'shows'
          })
      })

      return {
        type: 'profile' as const,
        data: {
          id: foundUser.id,
          displayUsername: foundUser.displayUsername,
          username: foundUser.username,
          image: foundUser.image,
          createdAt: foundUser.createdAt,
          content: {
            mixes: userMixes,
            shows: userShows
          }
        }
      }
    }

    const showRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(showsTable)
          .where(and(eq(showsTable.slug, slug), eq(showsTable.draft, false)))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to lookup show: ${(error as Error).message}`,
          operation: 'select',
          table: 'shows'
        })
    })

    const foundShow = showRecords[0]
    if (foundShow) {
      const hostsRaw = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: userTable.id,
              name: userTable.displayUsername,
              username: userTable.username
            })
            .from(showCreators)
            .innerJoin(userTable, eq(showCreators.creatorId, userTable.id))
            .where(eq(showCreators.showId, foundShow.id)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get show hosts: ${(error as Error).message}`,
            operation: 'select',
            table: 'show_creators'
          })
      })

      const hosts = hostsRaw.map((h) => ({
        id: h.id,
        name: h.name ?? 'Unknown',
        username: h.username
      }))

      let compiledContent: string | null = null
      const contentToCompile = foundShow.content
      if (contentToCompile) {
        const compiled = yield* Effect.tryPromise({
          try: () => compileMDX(contentToCompile),
          catch: () =>
            new DatabaseError({
              message: 'Failed to compile MDX content',
              operation: 'compile',
              table: 'shows'
            })
        })
        if (isMDXCompilationResult(compiled)) {
          compiledContent = compiled.compiled
        }
      }

      return {
        type: 'show' as const,
        data: {
          id: foundShow.id,
          title: foundShow.title,
          slug: foundShow.slug,
          description: foundShow.description,
          thumbnailUrl: foundShow.thumbnailUrl,
          bannerImageUrl: foundShow.bannerImageUrl,
          tags: foundShow.tags,
          createdAt: foundShow.createdAt,
          compiledContent,
          hosts
        }
      }
    }

    return yield* new NotFoundError({
      message: 'Not found',
      resource: 'slug',
      id: slug
    })
  })

export const ResolveServiceLive = Layer.succeed(ResolveService, {
  resolve: (slug) =>
    resolveEffect(slug).pipe(
      Effect.withSpan('resolve.slug', { attributes: { slug } })
    )
})
