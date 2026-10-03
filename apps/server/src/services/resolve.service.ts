import type { RichContentDocument } from '@gbfm/rich-content/schema'
import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'

import { user as userTable } from '@/db/auth.schema'
import { readEntityLabels } from '@/db/labels'
import { Database } from '@/db/layer'
import { showCreators, showsTable } from '@/db/show.schema'
import { DatabaseError, getErrorMessage, NotFoundError } from '@/errors'
import { MdxService } from '@/lib/mdx'
import { isReservedSlug } from '@/lib/reserved-slugs'
import { getPublicProfileEffect, type PublicProfile } from '@/services/profile.service'

type ShowData = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnailUrl: string | null
  bannerImageUrl: string | null
  tags: Array<string> | null
  createdAt: Date
  compiledContent: string | null
  richContent: RichContentDocument
  hosts: Array<{ id: string; name: string; username: string | null }>
}

export type ResolveResult =
  | { type: 'profile'; data: PublicProfile }
  | { type: 'show'; data: ShowData }

export interface ResolveService {
  readonly resolve: (slug: string) => Effect.Effect<ResolveResult, DatabaseError | NotFoundError>
}

export const ResolveService = Context.Service<ResolveService>('ResolveService')

const resolveEffect = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Database

    if (isReservedSlug(slug)) {
      return yield* new NotFoundError({
        message: 'Not found',
        resource: 'slug',
        id: slug,
      })
    }

    const userRecords = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: userTable.id,
            banned: userTable.banned,
            username: userTable.username,
          })
          .from(userTable)
          .where(eq(userTable.username, slug))
          .limit(1),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to lookup user: ${getErrorMessage(error)}`,
          operation: 'select',
          table: 'user',
        }),
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
          table: 'shows',
        }),
    })

    const foundShow = showRecords[0]

    if (foundShow) {
      const { tags } = yield* Effect.tryPromise({
        try: () => readEntityLabels(db, 'show', foundShow.id),
        catch: (error) =>
          new DatabaseError({
            message: getErrorMessage(error),
            operation: 'select',
            table: 'labels',
          }),
      })

      const hostsRaw = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: userTable.id,
              name: userTable.name,
              username: userTable.username,
            })
            .from(showCreators)
            .innerJoin(userTable, eq(showCreators.creatorId, userTable.id))
            .where(eq(showCreators.showId, foundShow.id)),
        catch: (error) =>
          new DatabaseError({
            message: `Failed to get show hosts: ${getErrorMessage(error)}`,
            operation: 'select',
            table: 'show_creators',
          }),
      })

      const hosts = hostsRaw.map((h) => ({
        id: h.id,
        name: h.name,
        username: h.username,
      }))

      const contentToCompile = foundShow.content
      const mdx = yield* MdxService

      const compiledContent = contentToCompile
        ? yield* mdx.compile(contentToCompile).pipe(Effect.orElseSucceed(() => null))
        : null

      const richContent = yield* mdx.render(contentToCompile)

      return {
        type: 'show' as const,
        data: {
          id: foundShow.id,
          title: foundShow.title,
          slug: foundShow.slug,
          description: foundShow.description,
          thumbnailUrl: foundShow.thumbnailUrl,
          bannerImageUrl: foundShow.bannerImageUrl,
          tags,
          createdAt: foundShow.createdAt,
          compiledContent,
          richContent,
          hosts,
        },
      }
    }

    return yield* new NotFoundError({
      message: 'Not found',
      resource: 'slug',
      id: slug,
    })
  })

export const ResolveServiceLayer = Layer.effect(
  ResolveService,
  Effect.gen(function* () {
    const db = yield* Database
    const mdx = yield* MdxService

    return {
      resolve: (slug) =>
        resolveEffect(slug).pipe(
          Effect.provideService(Database, db),
          Effect.provideService(MdxService, mdx),
          Effect.withSpan('resolve.slug', { attributes: { slug } }),
        ),
    }
  }),
)
