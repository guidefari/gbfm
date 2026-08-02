import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer, Redacted } from 'effect'
import {
  blueskySyncRuns,
  blueskySyncStates,
  externalAccountSessions,
  externalAccounts
} from '@/db/external-account.schema'
import { db } from '@/db'
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
import { z } from 'zod'

const cachedSession = z.object({ accessJwt: z.string().min(1), refreshJwt: z.string().min(1) })

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
  readonly sync: (input: {
    readonly userId: string
    readonly accountId: string
  }) => Effect.Effect<
    SyncRunSummary,
    | DatabaseError
    | NotFoundError
    | LockUnavailable
    | BlueskyProviderError
    | IdentityResolutionError
    | CryptoError
  >
}

export const BlueskySyncService = Context.Service<BlueskySyncService>('BlueskySyncService')

const databaseError = (operation: string) =>
  new DatabaseError({ message: 'Bluesky sync database operation failed', operation })

const sync = (
  client: BlueskyClient,
  importer: BlueskyImportService,
  archive: BlueskyArchiveService,
  crypto: CryptoService,
  locks: LockService,
  { userId, accountId }: Parameters<BlueskySyncService['sync']>[0]
) =>
  locks.withLock(
    `bluesky-sync:${accountId}`,
    Effect.gen(function* () {
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
            .select({ session: externalAccountSessions.session })
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
      const session = yield* Effect.try({
        try: () => cachedSession.safeParse(JSON.parse(Redacted.value(sessionPlaintext))),
        catch: () =>
          new CryptoError({ message: 'Bluesky session is invalid', operation: 'decrypt' })
      })
      if (!session.success) {
        return yield* new CryptoError({
          message: 'Bluesky session is invalid',
          operation: 'decrypt'
        })
      }

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
          db
            .insert(blueskySyncRuns)
            .values({ externalAccountId: accountId })
            .returning({ id: blueskySyncRuns.id }),
        catch: () => databaseError('create-run')
      })
      if (!run) return yield* databaseError('create-run')

      const feed = yield* client.getAuthorFeed({
        serviceEndpoint: account.serviceEndpoint ?? '',
        actorDid: account.providerAccountId,
        accessJwt: Redacted.make(session.data.accessJwt),
        cursor: currentState.cursor ?? undefined
      })
      const normalized = yield* importer.normalizeFeed(feed.entries, account.providerAccountId)
      const written = yield* archive.write({
        ownerUserId: userId,
        externalAccountId: accountId,
        records: normalized.records
      })
      const summary = {
        runId: run.id,
        discovered: normalized.discovered,
        qualifying: normalized.qualifying,
        created: written.created,
        alreadyImported: written.alreadyImported,
        conflicted: written.conflicted,
        failed: written.failed,
        cursor: feed.cursor
      }

      yield* Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            await tx
              .update(blueskySyncRuns)
              .set({
                status: 'succeeded',
                discovered: summary.discovered,
                qualifying: summary.qualifying,
                created: summary.created,
                alreadyImported: summary.alreadyImported,
                conflicted: summary.conflicted,
                failed: summary.failed,
                finishedAt: new Date()
              })
              .where(eq(blueskySyncRuns.id, run.id))
            await tx
              .update(blueskySyncStates)
              .set({
                cursor: summary.cursor,
                lastAttemptedAt: new Date(),
                lastStartedAt: new Date(),
                consecutiveFailures: 0,
                updatedAt: new Date()
              })
              .where(eq(blueskySyncStates.externalAccountId, accountId))
            await tx
              .update(externalAccounts)
              .set({ lastSuccessfulSyncAt: new Date(), updatedAt: new Date() })
              .where(eq(externalAccounts.id, accountId))
          }),
        catch: () => databaseError('complete-run')
      })
      return summary
    })
  )

export const BlueskySyncServiceLayer = Layer.effect(
  BlueskySyncService,
  Effect.gen(function* () {
    const client = yield* BlueskyClient
    const importer = yield* BlueskyImportService
    const archive = yield* BlueskyArchiveService
    const crypto = yield* CryptoService
    const locks = yield* LockService
    return {
      sync: (input: Parameters<BlueskySyncService['sync']>[0]) =>
        sync(client, importer, archive, crypto, locks, input)
    }
  })
)
