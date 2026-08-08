import { and, asc, desc, eq, gt, lt, sql } from 'drizzle-orm'
import { Context, Effect, Layer, Schema } from 'effect'
import {
  capabilitiesOf,
  type NavigationCommand,
  type NavigationIdentity,
  type NavigationResult,
  type NavigationSession,
  type ResolvedDestination,
  CorpusExhausted,
  Slug,
  NoSuchMove
} from '@/domain/navigation'
import {
  navigationSeenPosts,
  navigationSessions,
  navigationTrailEntries
} from '@/db/navigation.schema'
import { postsTable } from '@/db/post.schema'
import { DatabaseError, getErrorMessage, NotFoundError } from '@/errors'
import { DatabaseService } from '@/runtime/services'
import { PostService } from '@/services/post.service'

export type IntentToken = string

type TrailRow = {
  readonly slug: Slug
  readonly postId: string
  readonly position: number
  readonly arrivedBy: 'Step' | 'Jump' | 'Open'
  readonly visitedAt: Date
}

type SessionRow = typeof navigationSessions.$inferSelect

type Phase = {
  readonly session: SessionRow | undefined
  readonly length: number
  readonly replay: TrailRow | undefined
}

type Locked =
  | { readonly _tag: 'Duplicate'; readonly session: SessionRow }
  | { readonly _tag: 'Retry' }
  | { readonly _tag: 'Appended'; readonly session: SessionRow; readonly position: number }

export interface NavigationSessionService {
  readonly resolve: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug,
    intentToken: IntentToken
  ) => Effect.Effect<NavigationResult, NoSuchMove | CorpusExhausted | DatabaseError>
  readonly reset: (identity: NavigationIdentity) => Effect.Effect<void, DatabaseError>
}

export const NavigationSessionService = Context.Service<NavigationSessionService>(
  'NavigationSessionService'
)

const identityWhere = (identity: NavigationIdentity) =>
  identity._tag === 'User'
    ? eq(navigationSessions.userId, identity.userId)
    : eq(navigationSessions.deviceToken, identity.deviceToken)

const asSlug = Schema.decodeUnknownSync(Slug)

const arrivedBy = (value: string): TrailRow['arrivedBy'] => {
  switch (value) {
    case 'Step':
    case 'Jump':
    case 'Open':
      return value
    default:
      return 'Open'
  }
}

const databaseError = (operation: string, error: unknown) =>
  new DatabaseError({
    message: `Failed to ${operation} navigation session: ${getErrorMessage(error)}`,
    operation,
    table: 'navigation_sessions'
  })

const noSuchMove = (command: NavigationCommand) =>
  new NoSuchMove({
    command: command._tag === 'Step' ? `Step(${command.direction})` : command._tag
  })

const resultFor = (
  session: SessionRow,
  identity: NavigationIdentity,
  destination: TrailRow,
  index: number,
  length: number,
  hasUnread = true
): NavigationResult => {
  const navigationSession: NavigationSession = {
    id: session.id,
    identity,
    trail: Array.from({ length }, () => ({
      slug: destination.slug,
      postId: destination.postId,
      visitedAt: destination.visitedAt.getTime(),
      arrivedBy: destination.arrivedBy
    })),
    cursor: index,
    seenSlugs: new Set()
  }
  return {
    destination: { slug: destination.slug, postId: destination.postId },
    capabilities: capabilitiesOf(navigationSession, { hasUnread }),
    trailPosition: { index, length }
  }
}

export const NavigationSessionServiceLayer = Layer.effect(
  NavigationSessionService,
  Effect.gen(function* () {
    const { db } = yield* DatabaseService
    const posts = yield* PostService

    const liveEntry = (sessionId: string, position: number, direction: 'Back' | 'Forward') =>
      Effect.tryPromise({
        try: async () => {
          const condition =
            direction === 'Back'
              ? lt(navigationTrailEntries.position, position)
              : gt(navigationTrailEntries.position, position)
          const rows = await db
            .select({
              slug: navigationTrailEntries.slug,
              postId: navigationTrailEntries.postId,
              position: navigationTrailEntries.position,
              arrivedBy: navigationTrailEntries.arrivedBy,
              visitedAt: navigationTrailEntries.visitedAt
            })
            .from(navigationTrailEntries)
            .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
            .where(
              and(
                eq(navigationTrailEntries.sessionId, sessionId),
                condition,
                eq(postsTable.draft, false)
              )
            )
            .orderBy(
              direction === 'Back'
                ? desc(navigationTrailEntries.position)
                : asc(navigationTrailEntries.position)
            )
            .limit(1)
          const row = rows[0]
          return row
            ? {
                ...row,
                slug: asSlug(row.slug),
                arrivedBy: arrivedBy(row.arrivedBy)
              }
            : undefined
        },
        catch: (error) => databaseError('read', error)
      })

    const entryAtPosition = (sessionId: string, position: number) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              slug: navigationTrailEntries.slug,
              postId: navigationTrailEntries.postId,
              position: navigationTrailEntries.position,
              arrivedBy: navigationTrailEntries.arrivedBy,
              visitedAt: navigationTrailEntries.visitedAt
            })
            .from(navigationTrailEntries)
            .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
            .where(
              and(
                eq(navigationTrailEntries.sessionId, sessionId),
                eq(navigationTrailEntries.position, position),
                eq(postsTable.draft, false)
              )
            )
            .limit(1)
          const row = rows[0]
          return row
            ? { ...row, slug: asSlug(row.slug), arrivedBy: arrivedBy(row.arrivedBy) }
            : undefined
        },
        catch: (error) => databaseError('read', error)
      })

    const entryForSlug = (sessionId: string, slug: Slug) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({
              slug: navigationTrailEntries.slug,
              postId: navigationTrailEntries.postId,
              position: navigationTrailEntries.position,
              arrivedBy: navigationTrailEntries.arrivedBy,
              visitedAt: navigationTrailEntries.visitedAt
            })
            .from(navigationTrailEntries)
            .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
            .where(
              and(
                eq(navigationTrailEntries.sessionId, sessionId),
                eq(navigationTrailEntries.slug, slug),
                eq(postsTable.draft, false)
              )
            )
            .limit(1)
          const row = rows[0]
          return row
            ? {
                ...row,
                slug: asSlug(row.slug),
                arrivedBy: arrivedBy(row.arrivedBy)
              }
            : undefined
        },
        catch: (error) => databaseError('read', error)
      })

    const trailLength = (sessionId: string) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(navigationTrailEntries)
            .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
            .where(
              and(eq(navigationTrailEntries.sessionId, sessionId), eq(postsTable.draft, false))
            )
          return rows[0]?.count ?? 0
        },
        catch: (error) => databaseError('count', error)
      })

    const entryIndex = (sessionId: string, position: number) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(navigationTrailEntries)
            .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
            .where(
              and(
                eq(navigationTrailEntries.sessionId, sessionId),
                lt(navigationTrailEntries.position, position),
                eq(postsTable.draft, false)
              )
            )
          return rows[0]?.count ?? 0
        },
        catch: (error) => databaseError('count', error)
      })

    const readPhase = (identity: NavigationIdentity, command: NavigationCommand) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () => db.select().from(navigationSessions).where(identityWhere(identity)).limit(1),
          catch: (error) => databaseError('read', error)
        }).pipe(Effect.map((rows) => rows[0]))
        if (!session) return { session: undefined, length: 0, replay: undefined } satisfies Phase

        const length = yield* trailLength(session.id)
        if (command._tag === 'Open') {
          return {
            session,
            length,
            replay: yield* entryForSlug(session.id, command.slug)
          } satisfies Phase
        }
        if (command._tag === 'Step') {
          return {
            session,
            length,
            replay: yield* liveEntry(session.id, session.cursor, command.direction)
          } satisfies Phase
        }
        return { session, length, replay: undefined } satisfies Phase
      })

    const findUnread = (pick: 'NextByDate' | 'Random', from: Slug, seen: ReadonlySet<Slug>) =>
      Effect.gen(function* () {
        if (pick === 'Random') {
          const picked = yield* posts.getRandomMicroPost([...seen])
          if (seen.has(asSlug(picked.slug))) return yield* new CorpusExhausted()
          const post = yield* posts.getMicroPostBySlug(picked.slug)
          return {
            slug: asSlug(post.slug),
            postId: post.id,
            visitedAt: Date.now()
          } satisfies ResolvedDestination
        }

        let current = from
        while (true) {
          const adjacent = yield* posts.getAdjacentMicroPosts(current)
          if (!adjacent.next) return yield* new CorpusExhausted()
          current = asSlug(adjacent.next.slug)
          if (!seen.has(current)) {
            const post = yield* posts.getMicroPostBySlug(current)
            return {
              slug: asSlug(post.slug),
              postId: post.id,
              visitedAt: Date.now()
            } satisfies ResolvedDestination
          }
        }
      }).pipe(
        Effect.mapError((error) => (error instanceof NotFoundError ? new CorpusExhausted() : error))
      )

    const resolve = (
      identity: NavigationIdentity,
      command: NavigationCommand,
      from: Slug,
      intentToken: IntentToken,
      retried: boolean
    ): Effect.Effect<NavigationResult, NoSuchMove | CorpusExhausted | DatabaseError> =>
      Effect.gen(function* () {
        const phase = yield* readPhase(identity, command)
        yield* Effect.annotateCurrentSpan('trailLength', phase.length)
        yield* Effect.annotateCurrentSpan('cursor', phase.session?.cursor ?? -1)
        if (phase.replay && phase.session) {
          const index = yield* entryIndex(phase.session.id, phase.replay.position)
          return resultFor(phase.session, identity, phase.replay, index, phase.length)
        }
        if (command._tag === 'Step' && command.direction === 'Back') {
          return yield* noSuchMove(command)
        }

        const seen = phase.session
          ? yield* Effect.tryPromise({
              try: () =>
                db
                  .select({ slug: navigationSeenPosts.slug })
                  .from(navigationSeenPosts)
                  .where(eq(navigationSeenPosts.sessionId, phase.session?.id ?? '')),
              catch: (error) => databaseError('read', error)
            }).pipe(Effect.map((rows) => new Set(rows.map((row) => asSlug(row.slug)))))
          : new Set<Slug>()
        const destination =
          command._tag === 'Open'
            ? yield* posts.getMicroPostBySlug(command.slug).pipe(
                Effect.map((post) => ({
                  slug: asSlug(post.slug),
                  postId: post.id,
                  visitedAt: Date.now()
                })),
                Effect.mapError((error) =>
                  error instanceof NotFoundError ? new CorpusExhausted() : error
                )
              )
            : yield* findUnread(command._tag === 'Jump' ? 'Random' : 'NextByDate', from, seen)

        const locked = yield* Effect.tryPromise({
          try: () =>
            db.transaction(async (tx): Promise<Locked> => {
              const existing = await tx
                .select()
                .from(navigationSessions)
                .where(identityWhere(identity))
                .for('update')
                .limit(1)
              const session = existing[0]
              if (session?.lastIntentToken === intentToken) return { _tag: 'Duplicate', session }
              if (
                session &&
                (session.cursor !== phase.session?.cursor ||
                  session.updatedAt.getTime() !== phase.session?.updatedAt.getTime())
              ) {
                return { _tag: 'Retry' }
              }
              const created = session
                ? undefined
                : (
                    await tx
                      .insert(navigationSessions)
                      .values(
                        identity._tag === 'User'
                          ? { userId: identity.userId }
                          : { deviceToken: identity.deviceToken }
                      )
                      .onConflictDoNothing()
                      .returning()
                  )[0]
              const active =
                session ??
                created ??
                (
                  await tx
                    .select()
                    .from(navigationSessions)
                    .where(identityWhere(identity))
                    .for('update')
                    .limit(1)
                )[0]
              if (!active) throw new Error('Failed to create navigation session')
              const positions = await tx
                .select({ position: navigationTrailEntries.position })
                .from(navigationTrailEntries)
                .where(eq(navigationTrailEntries.sessionId, active.id))
                .orderBy(desc(navigationTrailEntries.position))
                .limit(1)
              const position = (positions[0]?.position ?? -1) + 1
              await tx.insert(navigationTrailEntries).values({
                sessionId: active.id,
                postId: destination.postId,
                slug: destination.slug,
                position,
                arrivedBy: command._tag
              })
              await tx
                .insert(navigationSeenPosts)
                .values({ sessionId: active.id, slug: destination.slug })
                .onConflictDoNothing()
              const [updated] = await tx
                .update(navigationSessions)
                .set({ cursor: position, lastIntentToken: intentToken, updatedAt: new Date() })
                .where(eq(navigationSessions.id, active.id))
                .returning()
              if (!updated) throw new Error('Failed to update navigation session')
              return { _tag: 'Appended', session: updated, position }
            }),
          catch: (error) => databaseError('transaction', error)
        })

        if (locked._tag === 'Retry') {
          if (retried) return yield* noSuchMove(command)
          return yield* resolve(identity, command, from, intentToken, true)
        }
        const entry =
          locked._tag === 'Appended'
            ? {
                slug: destination.slug,
                postId: destination.postId,
                position: locked.position,
                arrivedBy: command._tag,
                visitedAt: new Date(destination.visitedAt)
              }
            : yield* entryAtPosition(locked.session.id, locked.session.cursor)
        if (!entry) return yield* noSuchMove(command)
        const length = yield* trailLength(locked.session.id)
        const index = yield* entryIndex(locked.session.id, entry.position)
        return resultFor(locked.session, identity, entry, index, length)
      })

    return {
      resolve: (identity, command, from, intentToken) =>
        resolve(identity, command, from, intentToken, false).pipe(
          Effect.withSpan('navigation.resolve', {
            attributes: { command: command._tag, identityKind: identity._tag }
          })
        ),
      reset: (identity) =>
        Effect.tryPromise({
          try: async () => {
            await db.delete(navigationSessions).where(identityWhere(identity))
          },
          catch: (error) => databaseError('delete', error)
        })
    }
  })
)
