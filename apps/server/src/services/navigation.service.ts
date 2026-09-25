import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { Context, Effect, Layer, Predicate, Schema } from 'effect'

import { Database } from '@/db/layer'
import { navigationSeenPosts, navigationSessions } from '@/db/navigation.schema'
import { postsTable } from '@/db/post.schema'
import {
  CorpusExhausted,
  type MicroPostNeighbours,
  MicroPostMissing,
  type NavigationIdentity,
  Slug,
} from '@/domain/navigation'
import { DatabaseError, getErrorMessage } from '@/errors'

export interface NavigationService {
  readonly neighbours: (
    identity: NavigationIdentity,
    slug: string,
  ) => Effect.Effect<MicroPostNeighbours, MicroPostMissing | DatabaseError>
  readonly randomUnread: (
    identity: NavigationIdentity,
    slug: string,
  ) => Effect.Effect<Slug, CorpusExhausted | DatabaseError>
  readonly markSeen: (
    identity: NavigationIdentity,
    slug: string,
  ) => Effect.Effect<void, MicroPostMissing | DatabaseError>
}

export const NavigationService = Context.Service<NavigationService>('NavigationService')

const asSlug = Schema.decodeUnknownSync(Slug)

const databaseError = (operation: string, error: Parameters<typeof getErrorMessage>[0]) =>
  new DatabaseError({
    message: `Failed to ${operation} micro post navigation: ${getErrorMessage(error)}`,
    operation,
    table: 'navigation_seen_posts',
  })

const identityWhere = (identity: NavigationIdentity) =>
  Predicate.isTagged(identity, 'User')
    ? eq(navigationSessions.userId, identity.userId)
    : eq(navigationSessions.deviceToken, identity.deviceToken)

const feedPost = and(
  eq(postsTable.type, 'micro'),
  eq(postsTable.draft, false),
  isNull(postsTable.parentPostId),
)

export const NavigationServiceLayer = Layer.effect(
  NavigationService,
  Effect.gen(function* () {
    const db = yield* Database

    const sessionIds = (identity: NavigationIdentity) =>
      db
        .select({ id: navigationSessions.id })
        .from(navigationSessions)
        .where(identityWhere(identity))

    const currentPost = (slug: string) =>
      db
        .select({ slug: postsTable.slug, createdAt: postsTable.createdAt })
        .from(postsTable)
        .where(
          and(eq(postsTable.slug, slug), eq(postsTable.type, 'micro'), eq(postsTable.draft, false)),
        )
        .limit(1)

    const slugColumn = { slug: postsTable.slug }

    const countColumn = { count: sql<number>`CAST(count(*) AS INTEGER)` }

    const seenBy = (identity: NavigationIdentity) =>
      and(
        eq(navigationSeenPosts.slug, postsTable.slug),
        inArray(navigationSeenPosts.sessionId, sessionIds(identity)),
      )

    const feed = (condition: ReturnType<typeof and>) =>
      db.select(slugColumn).from(postsTable).where(and(feedPost, condition))

    const unreadFeed = (identity: NavigationIdentity, condition: ReturnType<typeof and>) =>
      db
        .select(slugColumn)
        .from(postsTable)
        .leftJoin(navigationSeenPosts, seenBy(identity))
        .where(and(feedPost, isNull(navigationSeenPosts.slug), condition))

    const unreadCount = (identity: NavigationIdentity, condition: ReturnType<typeof and>) =>
      db
        .select(countColumn)
        .from(postsTable)
        .leftJoin(navigationSeenPosts, seenBy(identity))
        .where(and(feedPost, isNull(navigationSeenPosts.slug), condition))

    const createdMonth = sql<string>`strftime('%Y-%m', ${postsTable.createdAt} / 1000, 'unixepoch')`

    const timeline = (identity: NavigationIdentity) =>
      db
        .select({
          month: createdMonth,
          total: sql<number>`CAST(count(*) AS INTEGER)`,
          unread: sql<number>`CAST(sum(CASE WHEN ${navigationSeenPosts.slug} IS NULL THEN 1 ELSE 0 END) AS INTEGER)`,
        })
        .from(postsTable)
        .leftJoin(navigationSeenPosts, seenBy(identity))
        .where(feedPost)
        .groupBy(createdMonth)
        .orderBy(createdMonth)

    const neighbours = (identity: NavigationIdentity, slug: string) => {
      const createdAt = db
        .select({ createdAt: postsTable.createdAt })
        .from(postsTable)
        .where(eq(postsTable.slug, slug))
        .limit(1)

      const newer = or(
        gt(postsTable.createdAt, createdAt),
        and(eq(postsTable.createdAt, createdAt), gt(postsTable.slug, slug)),
      )

      const older = or(
        lt(postsTable.createdAt, createdAt),
        and(eq(postsTable.createdAt, createdAt), lt(postsTable.slug, slug)),
      )

      return Effect.tryPromise({
        try: () =>
          db.batch([
            currentPost(slug),
            feed(newer).orderBy(asc(postsTable.createdAt), asc(postsTable.slug)).limit(1),
            unreadFeed(identity, older)
              .orderBy(desc(postsTable.createdAt), desc(postsTable.slug))
              .limit(1),
            feed(older).orderBy(desc(postsTable.createdAt), desc(postsTable.slug)).limit(1),
            unreadCount(identity, ne(postsTable.slug, slug)),
            timeline(identity),
          ]),
        catch: (error) => databaseError('read', error),
      }).pipe(
        Effect.flatMap(([current, back, olderUnread, olderAny, unreadRows, months]) => {
          if (!current[0]) return Effect.fail(new MicroPostMissing({ slug }))
          const forward = olderUnread[0] ?? olderAny[0]

          return Effect.succeed({
            back: back[0] ? asSlug(back[0].slug) : null,
            forward: forward ? asSlug(forward.slug) : null,
            unreadCount: unreadRows[0]?.count ?? 0,
            timeline: months,
          })
        }),
        Effect.withSpan('navigation.neighbours', { attributes: { slug } }),
      )
    }

    const randomUnread = (identity: NavigationIdentity, slug: string) =>
      Effect.tryPromise({
        try: () =>
          unreadFeed(identity, ne(postsTable.slug, slug))
            .orderBy(sql`random()`)
            .limit(1),
        catch: (error) => databaseError('read', error),
      }).pipe(
        Effect.flatMap(([row]) =>
          row ? Effect.succeed(asSlug(row.slug)) : Effect.fail(new CorpusExhausted()),
        ),
        Effect.withSpan('navigation.randomUnread'),
      )

    const markSeen = (identity: NavigationIdentity, slug: string) =>
      Effect.gen(function* () {
        const [current] = yield* Effect.tryPromise({
          try: () => currentPost(slug),
          catch: (error) => databaseError('read', error),
        })

        if (!current) return yield* new MicroPostMissing({ slug })

        return yield* Effect.tryPromise({
          try: () =>
            db.batch([
              db
                .insert(navigationSessions)
                .values(
                  Predicate.isTagged(identity, 'User')
                    ? { userId: identity.userId }
                    : { deviceToken: identity.deviceToken },
                )
                .onConflictDoNothing(),
              db
                .insert(navigationSeenPosts)
                .select(
                  db
                    .select({
                      sessionId: navigationSessions.id,
                      slug: sql`${current.slug}`.as('slug'),
                    })
                    .from(navigationSessions)
                    .where(identityWhere(identity)),
                )
                .onConflictDoNothing(),
              db
                .update(navigationSessions)
                .set({ updatedAt: new Date() })
                .where(identityWhere(identity)),
            ]),
          catch: (error) => databaseError('write', error),
        }).pipe(Effect.asVoid)
      }).pipe(Effect.withSpan('navigation.markSeen', { attributes: { slug } }))

    return { neighbours, randomUnread, markSeen }
  }),
)
