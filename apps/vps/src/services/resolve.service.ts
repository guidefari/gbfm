import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { db } from '@/db'
import { user as userTable } from '@/db/auth.schema'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError, getErrorMessage, NotFoundError } from '@/errors'
import { compileMDX, isMDXCompilationResult } from '@/lib/mdx'
import { isReservedSlug } from '@/lib/reserved-slugs'
import {
  getPublicProfileEffect,
  type PublicProfile
} from '@/services/profile.service'

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
  | { type: 'profile'; data: PublicProfile }
  | { type: 'show'; data: ShowData }

export interface ResolveService {
  readonly resolve: (
    slug: string
  ) => Effect.Effect<ResolveResult, DatabaseError | NotFoundError>
}

export const ResolveService = Context.Service<ResolveService>('ResolveService')

const resolveEffect = (slug: string) =>
  Effect.gen(function* () {
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
            banned: userTable.banned,
            username: userTable.username
          })
          .from(userTable)
          .where(eq(userTable.username, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to lookup user: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'user'
        })
    })

    const foundUser = userRecords[0]
    if (foundUser && !foundUser.banned) {
      const profile = yield* getPublicProfileEffect(slug)
      return { type: 'profile' as const, data: profile }
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
          message: `Failed to lookup show: ${getErrorMessage(error)}`,
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
              name: userTable.name,
              username: userTable.username
            })
            .from(showCreators)
            .innerJoin(userTable, eq(showCreators.creatorId, userTable.id))
            .where(eq(showCreators.showId, foundShow.id)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get show hosts: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'show_creators'
          })
      })

      const hosts = hostsRaw.map((h) => ({
        id: h.id,
        name: h.name,
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
