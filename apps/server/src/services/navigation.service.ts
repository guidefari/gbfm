import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, ne, sql } from 'drizzle-orm'
import { Context, Effect, Layer, Schema } from 'effect'
import {
  capabilitiesOf,
  type NavigationCommand,
  type NavigationIdentity,
  type NavigationResult,
  type ResolvedDestination,
  CorpusExhausted,
  NEIGHBOURHOOD_DEPTH,
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

type Neighbourhood = NavigationResult['neighbourhood']

const emptyNeighbourhood: Neighbourhood = { back: [], forward: [] }

type Locked =
  | { readonly _tag: 'Duplicate'; readonly session: SessionRow }
  | { readonly _tag: 'Retry' }
  | { readonly _tag: 'Appended'; readonly session: SessionRow; readonly position: number }

export type NavigationVisitOutcome = { readonly recorded: boolean }

export interface NavigationSessionService {
  readonly peek: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug
  ) => Effect.Effect<NavigationResult, NoSuchMove | CorpusExhausted | DatabaseError>
  readonly record: (
    identity: NavigationIdentity,
    command: NavigationCommand,
    from: Slug,
    intentToken: IntentToken
  ) => Effect.Effect<NavigationVisitOutcome, NoSuchMove | CorpusExhausted | DatabaseError>
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
  neighbours: NavigationResult['neighbours'] = {},
  neighbourhood: Neighbourhood = emptyNeighbourhood
): NavigationResult => {
  return {
    destination: { slug: destination.slug, postId: destination.postId },
    capabilities: capabilitiesOf(index, length, { hasUnread }),
    trailPosition: { index, length },
    neighbours,
    neighbourhood
  }
}

export const NavigationSessionServiceLayer = Layer.effect(
  NavigationSessionService,
  Effect.gen(function* () {
    const db = yield* Database
    const posts = yield* PostService
    const lock = yield* NavigationLock

    const unseenMicroPosts = (sessionId: string | undefined, extra?: ReturnType<typeof and>) => {
      const base = db
        .select({ id: postsTable.id, slug: postsTable.slug, createdAt: postsTable.createdAt })
        .from(postsTable)
      const scoped = sessionId
        ? base.leftJoin(
            navigationSeenPosts,
            and(
              eq(navigationSeenPosts.slug, postsTable.slug),
              eq(navigationSeenPosts.sessionId, sessionId)
            )
          )
        : base
      return scoped.where(
        and(
          eq(postsTable.type, 'micro'),
          eq(postsTable.draft, false),
          isNull(postsTable.parentPostId),
          sessionId ? isNull(navigationSeenPosts.slug) : undefined,
          extra
        )
      )
    }

    const trailEntryColumns = {
      slug: navigationTrailEntries.slug,
      postId: navigationTrailEntries.postId,
      position: navigationTrailEntries.position,
      arrivedBy: navigationTrailEntries.arrivedBy,
      visitedAt: navigationTrailEntries.visitedAt
    }

    const toTrailRow = (row: {
      slug: string
      postId: string
      position: number
      arrivedBy: string
      visitedAt: Date
    }): TrailRow => ({
      ...row,
      slug: asSlug(row.slug),
      arrivedBy: arrivedBy(row.arrivedBy)
    })

    const entryAtPosition = (sessionId: string, position: number) =>
      Effect.tryPromise({
        try: async () => {
          const rows = await db
            .select(trailEntryColumns)
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
          return row ? toTrailRow(row) : undefined
        },
        catch: (error) => databaseError('read', error)
      })

    const readSnapshot = (session: SessionRow) =>
      Effect.tryPromise({
        try: async () => {
          const [entryRows, lengthRows, indexRows, unreadRows] = await db.batch([
            db
              .select(trailEntryColumns)
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
            unseenMicroPosts(session.id).limit(1)
          ])
          const entry = entryRows[0]
          return {
            entry: entry ? toTrailRow(entry) : undefined,
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
              .limit(NEIGHBOURHOOD_DEPTH),
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
              .limit(NEIGHBOURHOOD_DEPTH),
            unseenMicroPosts(sessionId, lte(postsTable.createdAt, currentPostCreatedAt))
              .orderBy(desc(postsTable.createdAt))
              .limit(NEIGHBOURHOOD_DEPTH)
          ])
          const backSlugs = backRows.map((row) => asSlug(row.slug))
          const trailForwardSlugs = forwardRows.map((row) => asSlug(row.slug))
          const unreadSlugs = unreadRows.map((row) => asSlug(row.slug))
          const forwardSlugs = [...trailForwardSlugs, ...unreadSlugs].slice(0, NEIGHBOURHOOD_DEPTH)
          const back = backSlugs[0]
          const forward = forwardSlugs[0]
          const neighbours: MutableNeighbours = {}
          if (back) neighbours.back = back
          if (forward) neighbours.forward = forward
          return {
            length: lengthRows[0]?.count ?? 0,
            index: indexRows[0]?.count ?? 0,
            neighbours,
            neighbourhood: { back: backSlugs, forward: forwardSlugs } satisfies Neighbourhood,
            hasUnread: unreadRows.length > 0
          }
        },
        catch: (error) => databaseError('read', error)
      })
    }

    const sessionIdsForIdentity = (identity: NavigationIdentity) =>
      db
        .select({ id: navigationSessions.id })
        .from(navigationSessions)
        .where(identityWhere(identity))

    const replayStatement = (
      identity: NavigationIdentity,
      command: Exclude<NavigationCommand, { readonly _tag: 'Jump' }>
    ) => {
      const scoped = inArray(navigationTrailEntries.sessionId, sessionIdsForIdentity(identity))
      if (command._tag === 'Open') {
        return db
          .select(trailEntryColumns)
          .from(navigationTrailEntries)
          .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
          .where(
            and(scoped, eq(navigationTrailEntries.slug, command.slug), eq(postsTable.draft, false))
          )
          .limit(1)
      }
      const cursor = db
        .select({ cursor: navigationSessions.cursor })
        .from(navigationSessions)
        .where(identityWhere(identity))
        .limit(1)
      const condition =
        command.direction === 'Back'
          ? lt(navigationTrailEntries.position, cursor)
          : gt(navigationTrailEntries.position, cursor)
      return db
        .select(trailEntryColumns)
        .from(navigationTrailEntries)
        .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
        .where(and(scoped, condition, eq(postsTable.draft, false)))
        .orderBy(
          command.direction === 'Back'
            ? desc(navigationTrailEntries.position)
            : asc(navigationTrailEntries.position)
        )
        .limit(1)
    }

    const readPhase = (identity: NavigationIdentity, command: NavigationCommand) =>
      Effect.tryPromise({
        try: async () => {
          const scoped = inArray(navigationTrailEntries.sessionId, sessionIdsForIdentity(identity))
          const [sessionRows, lengthRows, replayRows] = await db.batch([
            db.select().from(navigationSessions).where(identityWhere(identity)).limit(1),
            db
              .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(and(scoped, eq(postsTable.draft, false))),
            command._tag === 'Jump'
              ? db
                  .select(trailEntryColumns)
                  .from(navigationTrailEntries)
                  .where(sql`0 = 1`)
                  .limit(1)
              : replayStatement(identity, command)
          ])
          const session = sessionRows[0]
          if (!session) return { session: undefined, length: 0, replay: undefined } satisfies Phase
          const replayRow = replayRows[0]
          return {
            session,
            length: lengthRows[0]?.count ?? 0,
            replay: replayRow ? toTrailRow(replayRow) : undefined
          } satisfies Phase
        },
        catch: (error) => databaseError('read', error)
      }).pipe(Effect.withSpan('navigation.session.read'))

    const findNextUnread = (sessionId: string | undefined, from: Slug) => {
      const currentPostCreatedAt = db
        .select({ createdAt: postsTable.createdAt })
        .from(postsTable)
        .where(and(eq(postsTable.slug, from), eq(postsTable.type, 'micro')))
        .limit(1)
      return Effect.tryPromise({
        try: async () => {
          const [post] = await unseenMicroPosts(
            sessionId,
            and(ne(postsTable.slug, from), lte(postsTable.createdAt, currentPostCreatedAt))
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
              snapshot.neighbours,
              snapshot.neighbourhood
            )
          }
          const snapshot = yield* snapshotEffect
          return resultFor(
            replay,
            snapshot.index,
            snapshot.length,
            snapshot.hasUnread,
            snapshot.neighbours,
            snapshot.neighbourhood
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
            snapshot.neighbours,
            snapshot.neighbourhood
          )
        }).pipe(Effect.withSpan('navigation.result.read'))
      })

    const peekSnapshot = (sessionId: string | undefined, from: Slug, destination: TrailRow) =>
      Effect.tryPromise({
        try: async () => {
          const fromCreatedAt = db
            .select({ createdAt: postsTable.createdAt })
            .from(postsTable)
            .where(and(eq(postsTable.slug, from), eq(postsTable.type, 'micro')))
            .limit(1)
          if (!sessionId) {
            const unreadRows = await unseenMicroPosts(
              undefined,
              and(ne(postsTable.slug, destination.slug), lte(postsTable.createdAt, fromCreatedAt))
            )
              .orderBy(desc(postsTable.createdAt))
              .limit(NEIGHBOURHOOD_DEPTH)
            const forwardSlugs = unreadRows.map((row) => asSlug(row.slug))
            const neighbours: MutableNeighbours = {}
            const forward = forwardSlugs[0]
            if (forward) neighbours.forward = forward
            return {
              index: 0,
              length: 1,
              neighbours,
              neighbourhood: { back: [], forward: forwardSlugs } satisfies Neighbourhood,
              hasUnread: forwardSlugs.length > 0
            }
          }
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
                  lt(navigationTrailEntries.position, destination.position),
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
                  lt(navigationTrailEntries.position, destination.position),
                  eq(postsTable.draft, false)
                )
              )
              .orderBy(desc(navigationTrailEntries.position))
              .limit(NEIGHBOURHOOD_DEPTH),
            db
              .select({ slug: navigationTrailEntries.slug })
              .from(navigationTrailEntries)
              .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
              .where(
                and(
                  eq(navigationTrailEntries.sessionId, sessionId),
                  gt(navigationTrailEntries.position, destination.position),
                  eq(postsTable.draft, false)
                )
              )
              .orderBy(asc(navigationTrailEntries.position))
              .limit(NEIGHBOURHOOD_DEPTH),
            unseenMicroPosts(
              sessionId,
              and(ne(postsTable.slug, destination.slug), lte(postsTable.createdAt, fromCreatedAt))
            )
              .orderBy(desc(postsTable.createdAt))
              .limit(NEIGHBOURHOOD_DEPTH)
          ])
          const backSlugs = backRows.map((row) => asSlug(row.slug))
          const forwardSlugs = [
            ...forwardRows.map((row) => asSlug(row.slug)),
            ...unreadRows.map((row) => asSlug(row.slug))
          ].slice(0, NEIGHBOURHOOD_DEPTH)
          const neighbours: MutableNeighbours = {}
          const back = backSlugs[0]
          const forward = forwardSlugs[0]
          if (back) neighbours.back = back
          if (forward) neighbours.forward = forward
          return {
            length: lengthRows[0]?.count ?? 0,
            index: indexRows[0]?.count ?? 0,
            neighbours,
            neighbourhood: { back: backSlugs, forward: forwardSlugs } satisfies Neighbourhood,
            hasUnread: unreadRows.length > 0
          }
        },
        catch: (error) => databaseError('read', error)
      })

    const peekOpenInOneBatch = (identity: NavigationIdentity, from: Slug, slug: Slug) => {
      const sessionIds = db
        .select({ id: navigationSessions.id })
        .from(navigationSessions)
        .where(identityWhere(identity))
      const scoped = inArray(navigationTrailEntries.sessionId, sessionIds)
      const destinationPosition = db
        .select({ position: navigationTrailEntries.position })
        .from(navigationTrailEntries)
        .where(and(scoped, eq(navigationTrailEntries.slug, slug)))
        .limit(1)
      const fromCreatedAt = db
        .select({ createdAt: postsTable.createdAt })
        .from(postsTable)
        .where(and(eq(postsTable.slug, from), eq(postsTable.type, 'micro')))
        .limit(1)
      const seenSessionIds = db
        .select({ id: navigationSessions.id })
        .from(navigationSessions)
        .where(identityWhere(identity))
      return Effect.tryPromise({
        try: async () => {
          const [entryRows, lengthRows, indexRows, backRows, forwardRows, unreadRows] =
            await db.batch([
              db
                .select(trailEntryColumns)
                .from(navigationTrailEntries)
                .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
                .where(
                  and(scoped, eq(navigationTrailEntries.slug, slug), eq(postsTable.draft, false))
                )
                .limit(1),
              db
                .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
                .from(navigationTrailEntries)
                .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
                .where(and(scoped, eq(postsTable.draft, false))),
              db
                .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
                .from(navigationTrailEntries)
                .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
                .where(
                  and(
                    scoped,
                    lt(navigationTrailEntries.position, destinationPosition),
                    eq(postsTable.draft, false)
                  )
                ),
              db
                .select({ slug: navigationTrailEntries.slug })
                .from(navigationTrailEntries)
                .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
                .where(
                  and(
                    scoped,
                    lt(navigationTrailEntries.position, destinationPosition),
                    eq(postsTable.draft, false)
                  )
                )
                .orderBy(desc(navigationTrailEntries.position))
                .limit(NEIGHBOURHOOD_DEPTH),
              db
                .select({ slug: navigationTrailEntries.slug })
                .from(navigationTrailEntries)
                .innerJoin(postsTable, eq(navigationTrailEntries.postId, postsTable.id))
                .where(
                  and(
                    scoped,
                    gt(navigationTrailEntries.position, destinationPosition),
                    eq(postsTable.draft, false)
                  )
                )
                .orderBy(asc(navigationTrailEntries.position))
                .limit(NEIGHBOURHOOD_DEPTH),
              db
                .select({ slug: postsTable.slug })
                .from(postsTable)
                .leftJoin(
                  navigationSeenPosts,
                  and(
                    eq(navigationSeenPosts.slug, postsTable.slug),
                    inArray(navigationSeenPosts.sessionId, seenSessionIds)
                  )
                )
                .where(
                  and(
                    eq(postsTable.type, 'micro'),
                    eq(postsTable.draft, false),
                    isNull(postsTable.parentPostId),
                    isNull(navigationSeenPosts.slug),
                    ne(postsTable.slug, slug),
                    lte(postsTable.createdAt, fromCreatedAt)
                  )
                )
                .orderBy(desc(postsTable.createdAt))
                .limit(NEIGHBOURHOOD_DEPTH)
            ])
          const entryRow = entryRows[0]
          if (!entryRow) return undefined
          const backSlugs = backRows.map((row) => asSlug(row.slug))
          const forwardSlugs = [
            ...forwardRows.map((row) => asSlug(row.slug)),
            ...unreadRows.map((row) => asSlug(row.slug))
          ].slice(0, NEIGHBOURHOOD_DEPTH)
          const neighbours: MutableNeighbours = {}
          const back = backSlugs[0]
          const forward = forwardSlugs[0]
          if (back) neighbours.back = back
          if (forward) neighbours.forward = forward
          return resultFor(
            toTrailRow(entryRow),
            indexRows[0]?.count ?? 0,
            lengthRows[0]?.count ?? 0,
            unreadRows.length > 0,
            neighbours,
            { back: backSlugs, forward: forwardSlugs }
          )
        },
        catch: (error) => databaseError('read', error)
      })
    }

    const peek = (identity: NavigationIdentity, command: NavigationCommand, from: Slug) =>
      Effect.gen(function* () {
        if (command._tag === 'Open') {
          const fast = yield* peekOpenInOneBatch(identity, from, command.slug)
          if (fast) return fast
        }
        const phase = yield* readPhase(identity, command)
        if (phase.replay) {
          const replay = phase.replay
          const snapshot = yield* peekSnapshot(phase.session?.id, from, replay)
          return resultFor(
            replay,
            snapshot.index,
            snapshot.length,
            snapshot.hasUnread,
            snapshot.neighbours,
            snapshot.neighbourhood
          )
        }
        if (command._tag === 'Step' && command.direction === 'Back') {
          return yield* noSuchMove(command)
        }
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
        const projected: TrailRow = {
          slug: destination.slug,
          postId: destination.postId,
          position: (phase.session?.cursor ?? -1) + 1,
          arrivedBy: command._tag,
          visitedAt: new Date(destination.visitedAt)
        }
        const snapshot = yield* peekSnapshot(phase.session?.id, from, projected)
        const length = phase.length + 1
        return resultFor(
          projected,
          phase.length,
          length,
          snapshot.hasUnread,
          snapshot.neighbours,
          snapshot.neighbourhood
        )
      }).pipe(Effect.withSpan('navigation.peek'))

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
      peek: (identity, command, from) =>
        peek(identity, command, from).pipe(
          Effect.tapError((error) => Effect.annotateCurrentSpan('errorType', error._tag))
        ),
      record: (identity, command, from, intentToken) =>
        resolve(identity, command, from, intentToken, 0).pipe(
          Effect.map(() => ({ recorded: true })),
          Effect.withSpan('navigation.record', {
            attributes:
              command._tag === 'Step'
                ? { command: command._tag, direction: command.direction }
                : { command: command._tag }
          })
        ),
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
