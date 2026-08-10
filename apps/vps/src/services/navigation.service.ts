import { and, asc, desc, eq, gt, isNull, lt, notExists, sql } from 'drizzle-orm'
import { Context, Effect, Layer, Schema } from 'effect'
import {
  capabilitiesOf,
  type NavigationCommand,
  type NavigationIdentity,
  type NavigationResult,
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
import { Database } from '@/db/layer'
import { PostService } from '@/services/post.service'
import { NavigationLock } from '@/services/navigation-lock'

export type IntentToken = string

export type NavigationSessionRead = {
  readonly slug: Slug | null
  readonly capabilities: NavigationResult['capabilities']
}

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
  readonly read: (
    identity: NavigationIdentity
  ) => Effect.Effect<NavigationSessionRead, DatabaseError>
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
const MAX_NAVIGATION_LOCK_RETRIES = 5

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
  destination: TrailRow,
  index: number,
  length: number,
  hasUnread = true,
  neighbours: NavigationResult['neighbours'] = {}
): NavigationResult => {
  return {
    destination: { slug: destination.slug, postId: destination.postId },
    capabilities: capabilitiesOf(index, length, { hasUnread }),
    trailPosition: { index, length },
    neighbours
  }
}

export const NavigationSessionServiceLayer = Layer.effect(
  NavigationSessionService,
  Effect.gen(function* () {
    const db = yield* Database
    const posts = yield* PostService
    const lock = yield* NavigationLock

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

    const hasUnread = (sessionId: string) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({ slug: postsTable.slug })
            .from(postsTable)
            .where(
              and(
                eq(postsTable.type, 'micro'),
                eq(postsTable.draft, false),
                isNull(postsTable.parentPostId),
                notExists(
                  db
                    .select()
                    .from(navigationSeenPosts)
                    .where(
                      and(
                        eq(navigationSeenPosts.sessionId, sessionId),
                        eq(navigationSeenPosts.slug, postsTable.slug)
                      )
                    )
                )
              )
            )
            .limit(1)
          return rows.length > 0
        },
        catch: (error) => databaseError('read', error)
      })

    const trailLength = (sessionId: string) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
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
            .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
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
      }).pipe(Effect.withSpan('navigation.session.read'))

    const neighboursFor = (sessionId: string, position: number) =>
      Effect.all({
        back: liveEntry(sessionId, position, 'Back'),
        forward: liveEntry(sessionId, position, 'Forward')
      }).pipe(
        Effect.map(({ back, forward }) => ({
          ...(back ? { back: back.slug } : {}),
          ...(forward ? { forward: forward.slug } : {})
        })),
        Effect.withSpan('navigation.neighbours.read')
      )

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
        Effect.mapError((error) =>
          error instanceof NotFoundError ? new CorpusExhausted() : error
        ),
        Effect.withSpan('navigation.destination.resolve', { attributes: { pick } })
      )

    const resolve = (
      identity: NavigationIdentity,
      command: NavigationCommand,
      from: Slug,
      intentToken: IntentToken,
      retryCount: number
    ): Effect.Effect<NavigationResult, NoSuchMove | CorpusExhausted | DatabaseError> =>
      Effect.gen(function* () {
        yield* Effect.annotateCurrentSpan('retried', retryCount > 0)
        const phase = yield* readPhase(identity, command)
        yield* Effect.annotateCurrentSpan('trailLength', phase.length)
        yield* Effect.annotateCurrentSpan('cursor', phase.session?.cursor ?? -1)
        if (phase.replay && phase.session && retryCount === 0) {
          const replay = phase.replay
          const session = phase.session
          yield* Effect.annotateCurrentSpan('path', 'replay')
          return yield* Effect.gen(function* () {
            const index = yield* entryIndex(session.id, replay.position)
            const neighbours = yield* neighboursFor(session.id, replay.position)
            return resultFor(replay, index, phase.length, yield* hasUnread(session.id), neighbours)
          }).pipe(Effect.withSpan('navigation.result.read'))
        }
        if (command._tag === 'Step' && command.direction === 'Back') {
          yield* Effect.annotateCurrentSpan('path', 'rejected')
          return yield* noSuchMove(command)
        }

        yield* Effect.annotateCurrentSpan('path', 'append')
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

        const decision = yield* lock
          .decide(identity, {
            sessionId: phase.session?.id ?? null,
            cursor: phase.session?.cursor ?? null,
            updatedAtMs: phase.session?.updatedAt.getTime() ?? null,
            intentToken
          })
          .pipe(Effect.withSpan('navigation.lock.decide'))

        const readSessionById = (sessionId: string) =>
          Effect.tryPromise({
            try: async () => {
              const rows = await db
                .select()
                .from(navigationSessions)
                .where(eq(navigationSessions.id, sessionId))
                .limit(1)
              return rows[0]
            },
            catch: (error) => databaseError('read', error)
          })

        const appendAndAdvance = (sessionId: string | null, position: number) =>
          Effect.tryPromise({
            try: async () => {
              const existing = sessionId
                ? (
                    await db
                      .select()
                      .from(navigationSessions)
                      .where(eq(navigationSessions.id, sessionId))
                      .limit(1)
                  )[0]
                : undefined
              const created = existing
                ? undefined
                : (
                    await db
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
                existing ??
                created ??
                (
                  await db.select().from(navigationSessions).where(identityWhere(identity)).limit(1)
                )[0]
              if (!active) throw new Error('Failed to create navigation session')
              await db.insert(navigationTrailEntries).values({
                sessionId: active.id,
                postId: destination.postId,
                slug: destination.slug,
                position,
                arrivedBy: command._tag
              })
              await db
                .insert(navigationSeenPosts)
                .values({ sessionId: active.id, slug: destination.slug })
                .onConflictDoNothing()
              const [updated] = await db
                .update(navigationSessions)
                .set({ cursor: position, lastIntentToken: intentToken, updatedAt: new Date() })
                .where(eq(navigationSessions.id, active.id))
                .returning()
              if (!updated) throw new Error('Failed to update navigation session')
              return updated
            },
            catch: (error) => databaseError('write', error)
          })

        const locked: Locked = yield* Effect.gen(function* () {
          if (decision._tag === 'Retry') return { _tag: 'Retry' as const }

          if (decision._tag === 'Duplicate') {
            const session = yield* readSessionById(decision.sessionId)
            if (!session) {
              return yield* Effect.fail(
                databaseError('read', 'Failed to read duplicate navigation session')
              )
            }
            return { _tag: 'Duplicate' as const, session }
          }

          const updated = yield* appendAndAdvance(decision.sessionId, decision.position).pipe(
            Effect.tapError(() => lock.reset(identity).pipe(Effect.ignore))
          )
          return { _tag: 'Appended' as const, session: updated, position: decision.position }
        }).pipe(Effect.withSpan('navigation.append.write'))

        if (locked._tag === 'Appended') {
          yield* lock
            .commit(identity, {
              sessionId: locked.session.id,
              position: locked.position,
              intentToken,
              updatedAtMs: locked.session.updatedAt.getTime()
            })
            .pipe(Effect.withSpan('navigation.lock.commit'))
        }

        yield* Effect.annotateCurrentSpan('lockOutcome', locked._tag)
        if (locked._tag === 'Retry') {
          if (retryCount === MAX_NAVIGATION_LOCK_RETRIES) return yield* noSuchMove(command)
          yield* Effect.sleep('1 millis')
          return yield* resolve(identity, command, from, intentToken, retryCount + 1)
        }
        return yield* Effect.gen(function* () {
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
          const neighbours = yield* neighboursFor(locked.session.id, entry.position)
          return resultFor(entry, index, length, yield* hasUnread(locked.session.id), neighbours)
        }).pipe(Effect.withSpan('navigation.result.read'))
      })

    const read = (identity: NavigationIdentity) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () => db.select().from(navigationSessions).where(identityWhere(identity)).limit(1),
          catch: (error) => databaseError('read', error)
        }).pipe(Effect.map((rows) => rows[0]))
        if (!session) {
          return {
            slug: null,
            capabilities: { canStepBack: false, canStepForward: false, hasUnread: false }
          }
        }
        const entry = yield* entryAtPosition(session.id, session.cursor)
        const length = yield* trailLength(session.id)
        if (!entry || length === 0) {
          return {
            slug: null,
            capabilities: { canStepBack: false, canStepForward: false, hasUnread: false }
          }
        }
        const index = yield* entryIndex(session.id, entry.position)
        return {
          slug: entry.slug,
          capabilities: capabilitiesOf(index, length, {
            hasUnread: yield* hasUnread(session.id)
          })
        }
      })

    return {
      resolve: (identity, command, from, intentToken) =>
        resolve(identity, command, from, intentToken, 0).pipe(
          Effect.tapError((error) => Effect.annotateCurrentSpan('errorType', error._tag)),
          Effect.withSpan('navigation.resolve', {
            attributes: {
              command: command._tag,
              ...(command._tag === 'Step' ? { direction: command.direction } : {}),
              identityKind: identity._tag
            }
          })
        ),
      read,
      reset: (identity) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () => db.delete(navigationSessions).where(identityWhere(identity)),
            catch: (error) => databaseError('delete', error)
          })
          yield* lock.reset(identity)
        })
    }
  })
)
