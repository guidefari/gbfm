import { and, eq, isNull, lte, or } from 'drizzle-orm'
import { Context, Effect, Layer, Option, Redacted, Schema } from 'effect'
import {
  blueskySyncRuns,
  blueskySyncStates,
  externalAccountSessions,
  externalAccounts
} from '@/db/external-account.schema'
import { Database } from '@/db/layer'
import {
  BlueskyProviderError,
  CryptoError,
  DatabaseError,
  IdentityResolutionError,
  LockUnavailable,
  NotFoundError
} from '@/errors'
import { BlueskyArchiveService } from './bluesky-archive.service'
import { BlueskyClient } from './bluesky-client.service'
import { BlueskyImportService } from './bluesky-importer.service'
import { CryptoService } from './crypto.service'
import { LockService } from './lock.service'

const CachedSession = Schema.Struct({
  accessJwt: Schema.NonEmptyString,
  refreshJwt: Schema.NonEmptyString
})

const decodeCachedSession = Schema.decodeUnknownOption(CachedSession)

export const MAX_CONSECUTIVE_FAILURES = 5
const MAX_BACKOFF_MS = 60 * 60 * 1000

type FailureSchedule = {
  readonly consecutiveFailures: number
  readonly scheduled: boolean
  readonly nextEligibleAt: Date | null
}

export const nextScheduleAfterFailure = (
  consecutiveFailures: number,
  now: Date
): FailureSchedule => {
  const failures = consecutiveFailures + 1
  if (failures >= MAX_CONSECUTIVE_FAILURES) {
    return { consecutiveFailures: failures, scheduled: false, nextEligibleAt: null }
  }
  const delay = Math.min(MAX_BACKOFF_MS, 2 ** failures * 60_000)
  return {
    consecutiveFailures: failures,
    scheduled: true,
    nextEligibleAt: new Date(now.getTime() + delay)
  }
}

const sessionPayload = (session: {
  readonly accessJwt: Redacted.Redacted<string>
  readonly refreshJwt: Redacted.Redacted<string>
}) =>
  Redacted.make(
    JSON.stringify({
      accessJwt: Redacted.value(session.accessJwt),
      refreshJwt: Redacted.value(session.refreshJwt)
    })
  )

export type SyncRunHandle = {
  readonly runId: string
  readonly status: 'queued'
}

export type SyncRunSummary = {
  readonly runId: string
  readonly discovered: number
  readonly qualifying: number
  readonly created: number
  readonly alreadyImported: number
  readonly conflicted: number
  readonly failed: number
  readonly cursor: string | undefined
}

export interface BlueskySyncService {
  readonly start: (input: {
    readonly userId: string
    readonly accountId: string
  }) => Effect.Effect<SyncRunHandle, DatabaseError | NotFoundError | LockUnavailable>
  readonly sync: (input: {
    readonly userId: string
    readonly accountId: string
    readonly runId?: string
  }) => Effect.Effect<
    SyncRunSummary,
    | DatabaseError
    | NotFoundError
    | LockUnavailable
    | BlueskyProviderError
    | IdentityResolutionError
    | CryptoError
  >
  readonly syncScheduled: () => Effect.Effect<ScheduledSyncReport, DatabaseError>
}

export type ScheduledSyncReport = {
  readonly attempted: number
  readonly succeeded: number
  readonly failed: number
}

export const BlueskySyncService = Context.Service<BlueskySyncService>('BlueskySyncService')

const databaseError = (operation: string) =>
  new DatabaseError({ message: 'Bluesky sync database operation failed', operation })

const start = (
  locks: LockService,
  { userId, accountId }: Parameters<BlueskySyncService['start']>[0]
): Effect.Effect<SyncRunHandle, DatabaseError | NotFoundError | LockUnavailable, Database> =>
  locks.withLock(
    `bluesky-sync:${accountId}`,
    Effect.gen(function* () {
      const db = yield* Database
      return yield* Effect.tryPromise({
        try: async () => {
          const [account] = await db
            .select({ id: externalAccounts.id })
            .from(externalAccounts)
            .where(and(eq(externalAccounts.id, accountId), eq(externalAccounts.userId, userId)))
            .limit(1)
          if (!account) throw new NotFoundError({ message: 'Bluesky account not found' })

          const [existing] = await db
            .select({ id: blueskySyncRuns.id })
            .from(blueskySyncRuns)
            .where(
              and(
                eq(blueskySyncRuns.externalAccountId, accountId),
                eq(blueskySyncRuns.status, 'running')
              )
            )
            .orderBy(blueskySyncRuns.startedAt)
            .limit(1)
          if (existing) return { runId: existing.id, status: 'queued' as const }

          const [run] = await db
            .insert(blueskySyncRuns)
            .values({ externalAccountId: accountId })
            .returning({ id: blueskySyncRuns.id })
          if (!run) throw databaseError('create-run')
          return { runId: run.id, status: 'queued' as const }
        },
        catch: (error): DatabaseError | NotFoundError =>
          error instanceof NotFoundError || error instanceof DatabaseError
            ? error
            : databaseError('start-run')
      })
    })
  )

const sync = (
  client: BlueskyClient,
  importer: BlueskyImportService,
  archive: BlueskyArchiveService,
  crypto: CryptoService,
  locks: LockService,
  { userId, accountId, runId }: Parameters<BlueskySyncService['sync']>[0]
) =>
  locks.withLock(
    `bluesky-sync:${accountId}`,
    Effect.gen(function* () {
      const db = yield* Database
      const [account] = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(externalAccounts)
            .where(and(eq(externalAccounts.id, accountId), eq(externalAccounts.userId, userId)))
            .limit(1),
        catch: () => databaseError('load-account')
      })
      if (!account) return yield* new NotFoundError({ message: 'Bluesky account not found' })

      const [credentials] = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              session: externalAccountSessions.session,
              appPassword: externalAccountSessions.appPassword
            })
            .from(externalAccountSessions)
            .where(eq(externalAccountSessions.externalAccountId, accountId))
            .limit(1),
        catch: () => databaseError('load-session')
      })
      if (!credentials?.session) {
        return yield* new DatabaseError({
          message: 'Bluesky session is missing',
          operation: 'load-session'
        })
      }
      const sessionPlaintext = yield* crypto.decrypt(credentials.session)
      const invalidSession = new CryptoError({
        message: 'Bluesky session is invalid',
        operation: 'decrypt'
      })
      const decoded = yield* Effect.try({
        try: () => decodeCachedSession(JSON.parse(Redacted.value(sessionPlaintext))),
        catch: () => invalidSession
      })
      if (Option.isNone(decoded)) return yield* invalidSession
      const session = decoded.value

      const appPassword = credentials.appPassword
      const authenticated = yield* client
        .refreshSession({
          serviceEndpoint: account.serviceEndpoint ?? '',
          refreshJwt: Redacted.make(session.refreshJwt),
          expectedDid: account.providerAccountId
        })
        .pipe(
          Effect.catch(() =>
            appPassword
              ? Effect.gen(function* () {
                  const password = yield* crypto.decrypt(appPassword)
                  return yield* client.login({
                    handle: account.handle ?? account.providerAccountId,
                    appPassword: password
                  })
                })
              : Effect.fail(
                  new BlueskyProviderError({
                    operation: 'refresh',
                    message: 'Bluesky authorization needs reconnection'
                  })
                )
          )
        )
      const refreshedEnvelope = yield* crypto.encrypt(sessionPayload(authenticated))
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(externalAccountSessions)
            .set({ session: refreshedEnvelope, updatedAt: new Date() })
            .where(eq(externalAccountSessions.externalAccountId, accountId)),
        catch: () => databaseError('persist-session')
      })

      const [state] = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(blueskySyncStates)
            .values({ externalAccountId: accountId })
            .onConflictDoNothing()
            .returning(),
        catch: () => databaseError('initialize-state')
      })
      const stateRows = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(blueskySyncStates)
            .where(eq(blueskySyncStates.externalAccountId, accountId))
            .limit(1),
        catch: () => databaseError('load-state')
      })
      const currentState = state ?? stateRows[0]
      if (!currentState) return yield* databaseError('load-state')

      const [run] = yield* Effect.tryPromise({
        try: () =>
          runId
            ? db
                .select({ id: blueskySyncRuns.id })
                .from(blueskySyncRuns)
                .where(
                  and(
                    eq(blueskySyncRuns.id, runId),
                    eq(blueskySyncRuns.externalAccountId, accountId)
                  )
                )
                .limit(1)
            : db
                .insert(blueskySyncRuns)
                .values({ externalAccountId: accountId })
                .returning({ id: blueskySyncRuns.id }),
        catch: () => databaseError('load-run')
      })
      if (!run) return yield* databaseError('load-run')

      const cutoff = new Date(Date.now() - currentState.lookbackDays * 24 * 60 * 60 * 1000)
      let cursor = currentState.cursor ?? undefined
      let pageCount = 0
      let discovered = 0
      let qualifying = 0
      let created = 0
      let alreadyImported = 0
      let conflicted = 0
      let failed = 0
      let reachedLookback = false

      while (!reachedLookback) {
        const feed = yield* client.getAuthorFeed({
          serviceEndpoint: account.serviceEndpoint ?? '',
          actorDid: account.providerAccountId,
          accessJwt: authenticated.accessJwt,
          cursor
        })
        pageCount += 1
        const normalized = yield* importer.normalizeFeed(feed.entries, account.providerAccountId)
        const written = yield* archive.write({
          ownerUserId: userId,
          externalAccountId: accountId,
          records: normalized.records
        })
        discovered += normalized.discovered
        qualifying += normalized.qualifying
        created += written.created
        alreadyImported += written.alreadyImported
        conflicted += written.conflicted
        failed += written.failed
        cursor = feed.cursor
        reachedLookback =
          !feed.cursor || normalized.records.some((record) => record.sourceCreatedAt <= cutoff)

        yield* Effect.tryPromise({
          try: () =>
            db
              .update(blueskySyncStates)
              .set({ cursor, updatedAt: new Date() })
              .where(eq(blueskySyncStates.externalAccountId, accountId)),
          catch: () => databaseError('advance-cursor')
        })
      }

      const summary = {
        runId: run.id,
        discovered,
        qualifying,
        created,
        alreadyImported,
        conflicted,
        failed,
        pageCount,
        cursor
      }

      yield* Effect.tryPromise({
        try: () =>
          db.batch([
            db
              .update(blueskySyncRuns)
              .set({
                status: 'succeeded',
                discovered: summary.discovered,
                qualifying: summary.qualifying,
                created: summary.created,
                alreadyImported: summary.alreadyImported,
                conflicted: summary.conflicted,
                failed: summary.failed,
                pageCount: summary.pageCount,
                finishedAt: new Date()
              })
              .where(eq(blueskySyncRuns.id, run.id)),
            db
              .update(blueskySyncStates)
              .set({
                cursor: summary.cursor,
                lastAttemptedAt: new Date(),
                lastStartedAt: new Date(),
                consecutiveFailures: 0,
                updatedAt: new Date()
              })
              .where(eq(blueskySyncStates.externalAccountId, accountId)),
            db
              .update(externalAccounts)
              .set({ lastSuccessfulSyncAt: new Date(), updatedAt: new Date() })
              .where(eq(externalAccounts.id, accountId))
          ]),
        catch: () => databaseError('complete-run')
      })
      return summary
    }).pipe(
      Effect.tapError((error) =>
        runId
          ? Effect.gen(function* () {
              const db = yield* Database
              yield* Effect.tryPromise({
                try: () =>
                  db
                    .update(blueskySyncRuns)
                    .set({ status: 'failed', errorCategory: error._tag, finishedAt: new Date() })
                    .where(eq(blueskySyncRuns.id, runId)),
                catch: () => undefined
              }).pipe(Effect.catch(() => Effect.void))
            })
          : Effect.void
      )
    )
  )

const dueScheduledAccounts = () =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* Effect.tryPromise({
      try: () =>
        db
          .select({ accountId: externalAccounts.id, userId: externalAccounts.userId })
          .from(externalAccounts)
          .innerJoin(
            blueskySyncStates,
            eq(blueskySyncStates.externalAccountId, externalAccounts.id)
          )
          .where(
            and(
              eq(externalAccounts.provider, 'bluesky'),
              eq(externalAccounts.status, 'active'),
              eq(blueskySyncStates.scheduled, true),
              or(
                isNull(blueskySyncStates.nextEligibleAt),
                lte(blueskySyncStates.nextEligibleAt, new Date())
              )
            )
          ),
      catch: () => databaseError('enumerate-scheduled-accounts')
    })
  })

const recordScheduledFailure = (accountId: string): Effect.Effect<void, DatabaseError, Database> =>
  Effect.gen(function* () {
    const db = yield* Database
    yield* Effect.tryPromise({
      try: async () => {
        const [state] = await db
          .select({ consecutiveFailures: blueskySyncStates.consecutiveFailures })
          .from(blueskySyncStates)
          .where(eq(blueskySyncStates.externalAccountId, accountId))
          .limit(1)
        const next = nextScheduleAfterFailure(state?.consecutiveFailures ?? 0, new Date())
        await db
          .update(blueskySyncStates)
          .set({ ...next, updatedAt: new Date() })
          .where(eq(blueskySyncStates.externalAccountId, accountId))
      },
      catch: () => databaseError('record-scheduled-failure')
    })
  })

const syncScheduled = (
  self: Pick<BlueskySyncService, 'sync'>
): Effect.Effect<ScheduledSyncReport, DatabaseError, Database> =>
  Effect.gen(function* () {
    const accounts = yield* dueScheduledAccounts()

    const outcomes = yield* Effect.forEach(
      accounts,
      (account) =>
        Effect.gen(function* () {
          const summary = yield* self.sync(account)
          yield* Effect.logInfo('Bluesky scheduled sync completed', {
            accountId: account.accountId,
            runId: summary.runId,
            created: summary.created,
            conflicted: summary.conflicted
          })
          return true
        }).pipe(
          Effect.catch((error) =>
            Effect.gen(function* () {
              yield* recordScheduledFailure(account.accountId).pipe(
                Effect.tapError((failure) =>
                  Effect.logError('Unable to record Bluesky scheduled sync failure', {
                    accountId: account.accountId,
                    error: failure
                  })
                ),
                Effect.catch(() => Effect.void)
              )
              yield* Effect.logError('Bluesky scheduled sync failed', {
                accountId: account.accountId,
                error
              })
              return false
            })
          )
        ),
      { concurrency: 1 }
    )

    const succeeded = outcomes.filter((ok) => ok).length
    return {
      attempted: accounts.length,
      succeeded,
      failed: accounts.length - succeeded
    }
  })

export const BlueskySyncServiceLayer = Layer.effect(
  BlueskySyncService,
  Effect.gen(function* () {
    const db = yield* Database
    const client = yield* BlueskyClient
    const importer = yield* BlueskyImportService
    const archive = yield* BlueskyArchiveService
    const crypto = yield* CryptoService
    const locks = yield* LockService
    const provideDb = Effect.provideService(Database, db)
    const service: BlueskySyncService = {
      start: (input: Parameters<BlueskySyncService['start']>[0]) => provideDb(start(locks, input)),
      sync: (input: Parameters<BlueskySyncService['sync']>[0]) =>
        provideDb(sync(client, importer, archive, crypto, locks, input)),
      syncScheduled: () => provideDb(syncScheduled(service))
    }
    return service
  })
)
