import { and, desc, eq, inArray } from 'drizzle-orm'
import { Context, Effect, Layer } from 'effect'
import { Database } from '@/db/layer'
import {
  type BlueskySourceStatus,
  blueskyPostSources,
  blueskySyncRuns,
  externalAccounts,
  type SelectBlueskyPostSource,
  type SelectBlueskySyncRun
} from '@/db/external-account.schema'
import { postsTable } from '@/db/post.schema'
import { DatabaseError, NotFoundError } from '@/errors'

export type SourceWithPost = SelectBlueskyPostSource & {
  readonly postSlug: string | null
  readonly postDraft: boolean | null
}

export interface BlueskyRunsService {
  readonly listRuns: (input: {
    readonly userId: string
    readonly accountId: string
    readonly limit: number
  }) => Effect.Effect<ReadonlyArray<SelectBlueskySyncRun>, DatabaseError | NotFoundError>
  readonly listSources: (input: {
    readonly userId: string
    readonly accountId: string
    readonly statuses?: ReadonlyArray<BlueskySourceStatus>
    readonly limit: number
    readonly offset: number
  }) => Effect.Effect<ReadonlyArray<SourceWithPost>, DatabaseError | NotFoundError>
  readonly setSourceStatus: (input: {
    readonly userId: string
    readonly sourceId: string
    readonly sourceStatus: BlueskySourceStatus
  }) => Effect.Effect<void, DatabaseError | NotFoundError>
}

export const BlueskyRunsService = Context.Service<BlueskyRunsService>('BlueskyRunsService')

const databaseError = (operation: string) =>
  new DatabaseError({ message: 'Bluesky runs database operation failed', operation })

// Ownership for runs and sources is only expressible through the owning
// external account, so every read re-checks it rather than trusting the id.
const requireOwnedAccount = (userId: string, accountId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: externalAccounts.id })
          .from(externalAccounts)
          .where(and(eq(externalAccounts.id, accountId), eq(externalAccounts.userId, userId)))
          .limit(1),
      catch: () => databaseError('select')
    })
    if (rows.length === 0) {
      return yield* new NotFoundError({ message: 'Bluesky account not found' })
    }
  })

const listRunsEffect = ({
  userId,
  accountId,
  limit
}: {
  readonly userId: string
  readonly accountId: string
  readonly limit: number
}) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* requireOwnedAccount(userId, accountId)
    return yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(blueskySyncRuns)
          .where(eq(blueskySyncRuns.externalAccountId, accountId))
          .orderBy(desc(blueskySyncRuns.startedAt))
          .limit(limit),
      catch: () => databaseError('select')
    })
  })

const listSourcesEffect = ({
  userId,
  accountId,
  statuses,
  limit,
  offset
}: {
  readonly userId: string
  readonly accountId: string
  readonly statuses?: ReadonlyArray<BlueskySourceStatus>
  readonly limit: number
  readonly offset: number
}) =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* requireOwnedAccount(userId, accountId)
    const statusCondition =
      statuses && statuses.length > 0
        ? inArray(blueskyPostSources.sourceStatus, [...statuses])
        : undefined

    return yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            source: blueskyPostSources,
            postSlug: postsTable.slug,
            postDraft: postsTable.draft
          })
          .from(blueskyPostSources)
          .leftJoin(postsTable, eq(postsTable.id, blueskyPostSources.postId))
          .where(and(eq(blueskyPostSources.externalAccountId, accountId), statusCondition))
          .orderBy(desc(blueskyPostSources.sourceCreatedAt))
          .limit(limit)
          .offset(offset)
          .then((rows) =>
            rows.map((row) => ({
              ...row.source,
              postSlug: row.postSlug,
              postDraft: row.postDraft
            }))
          ),
      catch: () => databaseError('select')
    })
  })

const setSourceStatusEffect = ({
  userId,
  sourceId,
  sourceStatus
}: {
  readonly userId: string
  readonly sourceId: string
  readonly sourceStatus: BlueskySourceStatus
}) =>
  Effect.gen(function* () {
    const db = yield* Database
    const owned = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: blueskyPostSources.id })
          .from(blueskyPostSources)
          .innerJoin(
            externalAccounts,
            eq(externalAccounts.id, blueskyPostSources.externalAccountId)
          )
          .where(and(eq(blueskyPostSources.id, sourceId), eq(externalAccounts.userId, userId)))
          .limit(1),
      catch: () => databaseError('select')
    })
    if (owned.length === 0) {
      return yield* new NotFoundError({ message: 'Bluesky source not found' })
    }

    yield* Effect.tryPromise({
      try: () =>
        db
          .update(blueskyPostSources)
          .set({ sourceStatus })
          .where(eq(blueskyPostSources.id, sourceId)),
      catch: () => databaseError('update')
    })
  })

export const BlueskyRunsServiceLayer = Layer.effect(
  BlueskyRunsService,
  Effect.gen(function* () {
    const db = yield* Database
    const provideDb = Effect.provideService(Database, db)
    return {
      listRuns: (input) => provideDb(listRunsEffect(input)),
      listSources: (input) => provideDb(listSourcesEffect(input)),
      setSourceStatus: (input) => provideDb(setSourceStatusEffect(input))
    }
  })
)
