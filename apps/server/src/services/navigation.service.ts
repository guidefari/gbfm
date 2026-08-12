import { and, asc, desc, eq, gt, isNull, lt, lte, ne, notExists, sql } from 'drizzle-orm'
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

type MutableNeighbours = {
  back?: Slug
  forward?: Slug
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

const databaseError = (operation: string, error: Parameters<typeof getErrorMessage>[0]) =>
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

    const readSnapshot = (session: SessionRow) =>
      Effect.tryPromise({
        try: async () => {
          const [entryRows, lengthRows, indexRows, unreadRows] = await db.batch([
            db
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
                  eq(navigationTrailEntries.sessionId, session.id),
                  eq(navigationTrailEntries.position, session.cursor),
                  eq(postsTable.draft, false)
                )
              )
              .limit(1),
            db
              .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(
                and(eq(navigationTrailEntries.sessionId, session.id), eq(postsTable.draft, false))
              ),
            db
              .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(
                and(
                  eq(navigationTrailEntries.sessionId, session.id),
                  lt(navigationTrailEntries.position, session.cursor),
                  eq(postsTable.draft, false)
                )
              ),
            db
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
                          eq(navigationSeenPosts.sessionId, session.id),
                          eq(navigationSeenPosts.slug, postsTable.slug)
                        )
                      )
                  )
                )
              )
              .limit(1)
          ])
          const entry = entryRows[0]
          return {
            entry: entry
              ? { ...entry, slug: asSlug(entry.slug), arrivedBy: arrivedBy(entry.arrivedBy) }
              : undefined,
            length: lengthRows[0]?.count ?? 0,
            index: indexRows[0]?.count ?? 0,
            hasUnread: unreadRows.length > 0
          }
        },
        catch: (error) => databaseError('read', error)
      })

    const resultSnapshot = (sessionId: string, position: number) => {
      const currentPostCreatedAt = db
        .select({ createdAt: postsTable.createdAt })
        .from(navigationTrailEntries)
        .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
        .where(
          and(
            eq(navigationTrailEntries.sessionId, sessionId),
            eq(navigationTrailEntries.position, position)
          )
        )
        .limit(1)
      return Effect.tryPromise({
        try: async () => {
          const [lengthRows, indexRows, backRows, forwardRows, unreadRows] = await db.batch([
            db
              .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(
                and(eq(navigationTrailEntries.sessionId, sessionId), eq(postsTable.draft, false))
              ),
            db
              .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(
                and(
                  eq(navigationTrailEntries.sessionId, sessionId),
                  lt(navigationTrailEntries.position, position),
                  eq(postsTable.draft, false)
                )
              ),
            db
              .select({ slug: navigationTrailEntries.slug })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(
                and(
                  eq(navigationTrailEntries.sessionId, sessionId),
                  lt(navigationTrailEntries.position, position),
                  eq(postsTable.draft, false)
                )
              )
              .orderBy(desc(navigationTrailEntries.position))
              .limit(1),
            db
              .select({ slug: navigationTrailEntries.slug })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(
                and(
                  eq(navigationTrailEntries.sessionId, sessionId),
                  gt(navigationTrailEntries.position, position),
                  eq(postsTable.draft, false)
                )
              )
              .orderBy(asc(navigationTrailEntries.position))
              .limit(1),
            db
              .select({ slug: postsTable.slug })
              .from(postsTable)
              .where(
                and(
                  eq(postsTable.type, 'micro'),
                  eq(postsTable.draft, false),
                  isNull(postsTable.parentPostId),
                  lte(postsTable.createdAt, currentPostCreatedAt),
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
              .orderBy(desc(postsTable.createdAt))
              .limit(1)
          ])
          const back = backRows[0]
          const forward = forwardRows[0] ?? unreadRows[0]
          const neighbours: MutableNeighbours = {}
          if (back) neighbours.back = asSlug(back.slug)
          if (forward) neighbours.forward = asSlug(forward.slug)
          return {
            length: lengthRows[0]?.count ?? 0,
            index: indexRows[0]?.count ?? 0,
            neighbours,
            hasUnread: unreadRows.length > 0
          }
        },
        catch: (error) => databaseError('read', error)
      })
    }

    const readPhase = (identity: NavigationIdentity, command: NavigationCommand) =>
      Effect.gen(function* () {
        const session = yield* Effect.tryPromise({
          try: () => db.select().from(navigationSessions).where(identityWhere(identity)).limit(1),
          catch: (error) => databaseError('read', error)
        }).pipe(Effect.map((rows) => rows[0]))
        if (!session) return { session: undefined, length: 0, replay: undefined } satisfies Phase

        const replayEffect =
          command._tag === 'Open'
            ? entryForSlug(session.id, command.slug)
            : command._tag === 'Step'
              ? liveEntry(session.id, session.cursor, command.direction)
              : Effect.succeed(undefined)
        const { length, replay } = yield* Effect.all(
          {
            length: trailLength(session.id),
            replay: replayEffect
          },
          { concurrency: 'unbounded' }
        )
        return { session, length, replay } satisfies Phase
      }).pipe(Effect.withSpan('navigation.session.read'))

    const neighboursFor = (sessionId: string, position: number) =>
      Effect.all(
        {
          back: liveEntry(sessionId, position, 'Back'),
          forward: liveEntry(sessionId, position, 'Forward')
        },
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.map(({ back, forward }) => {
          const neighbours: MutableNeighbours = {}
          if (back) neighbours.back = back.slug
          if (forward) neighbours.forward = forward.slug
          return neighbours
        }),
        Effect.withSpan('navigation.neighbours.read')
      )

    const findNextUnread = (sessionId: string | undefined, from: Slug) => {
      const currentPostCreatedAt = db
        .select({ createdAt: postsTable.createdAt })
        .from(postsTable)
        .where(and(eq(postsTable.slug, from), eq(postsTable.type, 'micro')))
        .limit(1)
      return Effect.tryPromise({
        try: async () => {
          const [post] = await db
            .select({ id: postsTable.id, slug: postsTable.slug })
            .from(postsTable)
            .where(
              and(
                eq(postsTable.type, 'micro'),
                eq(postsTable.draft, false),
                isNull(postsTable.parentPostId),
                ne(postsTable.slug, from),
                lte(postsTable.createdAt, currentPostCreatedAt),
                sessionId
                  ? notExists(
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
                  : undefined
              )
            )
            .orderBy(desc(postsTable.createdAt))
            .limit(1)
          if (!post) throw new CorpusExhausted()
          return {
            slug: asSlug(post.slug),
            postId: post.id,
            visitedAt: Date.now()
          } satisfies ResolvedDestination
        },
        catch: (error) =>
          error instanceof CorpusExhausted
            ? error
            : databaseError('resolve next unread destination', error)
      }).pipe(
        Effect.withSpan('navigation.destination.resolve', { attributes: { pick: 'NextByDate' } })
      )
    }

    const findRandomUnread = (seen: ReadonlySet<Slug>) =>
      posts.getRandomMicroPost([...seen]).pipe(
        Effect.flatMap((picked) =>
          seen.has(asSlug(picked.slug))
            ? Effect.fail(new CorpusExhausted())
            : Effect.succeed({
                slug: asSlug(picked.slug),
                postId: picked.id,
                visitedAt: Date.now()
              } satisfies ResolvedDestination)
        ),
        Effect.mapError((error) =>
          error instanceof NotFoundError ? new CorpusExhausted() : error
        ),
        Effect.withSpan('navigation.destination.resolve', { attributes: { pick: 'Random' } })
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
        if (phase.replay && phase.session) {
          const replay = phase.replay
          const session = phase.session
          yield* Effect.annotateCurrentSpan('path', 'replay')
          const snapshotEffect = resultSnapshot(session.id, replay.position).pipe(
            Effect.withSpan('navigation.result.read')
          )
          if (replay.position !== session.cursor) {
            const updateEffect = Effect.tryPromise({
              try: async () => {
                const [row] = await db
                  .update(navigationSessions)
                  .set({
                    cursor: replay.position,
                    lastIntentToken: intentToken,
                    updatedAt: new Date()
                  })
                  .where(
                    and(
                      eq(navigationSessions.id, session.id),
                      eq(navigationSessions.cursor, session.cursor),
                      eq(navigationSessions.updatedAt, session.updatedAt)
                    )
                  )
                  .returning()
                return row
              },
              catch: (error) => databaseError('update', error)
            }).pipe(Effect.withSpan('navigation.cursor.update'))
            const { updated, snapshot } = yield* Effect.all(
              { updated: updateEffect, snapshot: snapshotEffect },
              { concurrency: 'unbounded' }
            )
            if (!updated) {
              if (retryCount === MAX_NAVIGATION_LOCK_RETRIES) return yield* noSuchMove(command)
              yield* Effect.sleep('1 millis')
              return yield* resolve(identity, command, from, intentToken, retryCount + 1)
            }
            yield* lock.sync(identity, {
              sessionId: updated.id,
              position: replay.position,
              intentToken,
              updatedAtMs: updated.updatedAt.getTime()
            })
            return resultFor(
              replay,
              snapshot.index,
              snapshot.length,
              snapshot.hasUnread,
              snapshot.neighbours
            )
          }
          const snapshot = yield* snapshotEffect
          return resultFor(
            replay,
            snapshot.index,
            snapshot.length,
            snapshot.hasUnread,
            snapshot.neighbours
          )
        }
        if (command._tag === 'Step' && command.direction === 'Back') {
          yield* Effect.annotateCurrentSpan('path', 'rejected')
          return yield* noSuchMove(command)
        }

        yield* Effect.annotateCurrentSpan('path', 'append')
        const destination = yield* (() => {
          if (command._tag === 'Open') {
            return posts.getMicroPostReferenceBySlug(command.slug).pipe(
              Effect.map((post) => ({
                slug: asSlug(post.slug),
                postId: post.id,
                visitedAt: Date.now()
              })),
              Effect.mapError((error) =>
                error instanceof NotFoundError ? new CorpusExhausted() : error
              )
            )
          }
          if (command._tag === 'Step') return findNextUnread(phase.session?.id, from)
          const seenEffect = phase.session
            ? Effect.tryPromise({
                try: () =>
                  db
                    .select({ slug: navigationSeenPosts.slug })
                    .from(navigationSeenPosts)
                    .where(eq(navigationSeenPosts.sessionId, phase.session?.id ?? '')),
                catch: (error) => databaseError('read', error)
              }).pipe(Effect.map((rows) => new Set(rows.map((row) => asSlug(row.slug)))))
            : Effect.succeed(new Set<Slug>())
          return seenEffect.pipe(Effect.flatMap(findRandomUnread))
        })()

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

        const appendAndAdvance = (
          sessionId: string | null,
          position: number,
          knownSession: SessionRow | undefined
        ) =>
          Effect.tryPromise({
            try: async () => {
              const existing =
                knownSession?.id === sessionId
                  ? knownSession
                  : sessionId
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
              const [, , updatedRows] = await db.batch([
                db.insert(navigationTrailEntries).values({
                  sessionId: active.id,
                  postId: destination.postId,
                  slug: destination.slug,
                  position,
                  arrivedBy: command._tag
                }),
                db
                  .insert(navigationSeenPosts)
                  .values({ sessionId: active.id, slug: destination.slug })
                  .onConflictDoNothing(),
                db
                  .update(navigationSessions)
                  .set({ cursor: position, lastIntentToken: intentToken, updatedAt: new Date() })
                  .where(eq(navigationSessions.id, active.id))
                  .returning()
              ])
              const updated = updatedRows[0]
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

          const updated = yield* appendAndAdvance(
            decision.sessionId,
            decision.position,
            phase.session
          ).pipe(Effect.tapError(() => lock.reset(identity).pipe(Effect.ignore)))
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
          const snapshot = yield* resultSnapshot(locked.session.id, entry.position)
          return resultFor(
            entry,
            snapshot.index,
            snapshot.length,
            snapshot.hasUnread,
            snapshot.neighbours
          )
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
        const snapshot = yield* readSnapshot(session)
        if (!snapshot.entry || snapshot.length === 0) {
          return {
            slug: null,
            capabilities: { canStepBack: false, canStepForward: false, hasUnread: false }
          }
        }
        return {
          slug: snapshot.entry.slug,
          capabilities: capabilitiesOf(snapshot.index, snapshot.length, {
            hasUnread: snapshot.hasUnread
          })
        }
      })

    return {
      resolve: (identity, command, from, intentToken) =>
        resolve(identity, command, from, intentToken, 0).pipe(
          Effect.tapError((error) => Effect.annotateCurrentSpan('errorType', error._tag)),
          Effect.withSpan('navigation.resolve', {
            attributes:
              command._tag === 'Step'
                ? {
                    command: command._tag,
                    direction: command.direction,
                    identityKind: identity._tag
                  }
                : { command: command._tag, identityKind: identity._tag }
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
