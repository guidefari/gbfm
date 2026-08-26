import { and, eq, sql } from 'drizzle-orm'
import { Context, Effect, Layer, Redacted } from 'effect'
import { Database } from '@/db/layer'
import {
  blueskySyncStates,
  externalAccountSessions,
  externalAccounts,
  type SelectExternalAccount
} from '@/db/external-account.schema'
import {
  BlueskyProviderError,
  CryptoError,
  DatabaseError,
  IdentityResolutionError,
  NotFoundError
} from '@/errors'
import { BlueskyClient } from './bluesky-client.service'
import { CryptoService } from './crypto.service'

export interface BlueskyAccountService {
  readonly connect: (input: {
    readonly userId: string
    readonly handle: string
    readonly appPassword: Redacted.Redacted<string>
  }) => Effect.Effect<
    SelectExternalAccount,
    DatabaseError | NotFoundError | BlueskyProviderError | IdentityResolutionError | CryptoError
  >
  readonly list: (
    userId: string
  ) => Effect.Effect<
    ReadonlyArray<SelectExternalAccount & { readonly scheduled: boolean }>,
    DatabaseError
  >
  readonly disconnect: (
    userId: string,
    accountId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
  readonly setScheduled: (
    userId: string,
    accountId: string,
    scheduled: boolean
  ) => Effect.Effect<boolean, DatabaseError | NotFoundError>
}

export const BlueskyAccountService = Context.Service<BlueskyAccountService>('BlueskyAccountService')

const databaseError = (operation: string) =>
  new DatabaseError({ message: 'External account database operation failed', operation })

const sessionPayload = (input: {
  readonly accessJwt: Redacted.Redacted<string>
  readonly refreshJwt: Redacted.Redacted<string>
}) =>
  JSON.stringify({
    accessJwt: Redacted.value(input.accessJwt),
    refreshJwt: Redacted.value(input.refreshJwt)
  })

const connectEffect = ({
  userId,
  handle,
  appPassword
}: Parameters<BlueskyAccountService['connect']>[0]) =>
  Effect.gen(function* () {
    const db = yield* Database
    const client = yield* BlueskyClient
    const crypto = yield* CryptoService
    const login = yield* client.login({ handle, appPassword })
    const encryptedPassword = yield* crypto.encrypt(appPassword)
    const encryptedSession = yield* crypto.encrypt(
      Redacted.make(sessionPayload({ accessJwt: login.accessJwt, refreshJwt: login.refreshJwt }))
    )

    return yield* Effect.tryPromise({
      try: async () => {
        await db.batch([
          db
            .insert(externalAccounts)
            .values({
              userId,
              provider: 'bluesky',
              providerAccountId: login.did,
              handle: login.handle,
              issuer: login.did,
              serviceEndpoint: login.serviceEndpoint,
              status: 'active'
            })
            .onConflictDoUpdate({
              target: [
                externalAccounts.userId,
                externalAccounts.provider,
                externalAccounts.providerAccountId
              ],
              set: {
                handle: login.handle,
                serviceEndpoint: login.serviceEndpoint,
                status: 'active',
                lastErrorCategory: null,
                updatedAt: new Date()
              }
            }),
          db
            .insert(externalAccountSessions)
            .values({
              externalAccountId: sql`(
                select ${externalAccounts.id}
                from ${externalAccounts}
                where ${externalAccounts.userId} = ${userId}
                  and ${externalAccounts.provider} = 'bluesky'
                  and ${externalAccounts.providerAccountId} = ${login.did}
              )`,
              appPassword: encryptedPassword,
              session: encryptedSession
            })
            .onConflictDoUpdate({
              target: externalAccountSessions.externalAccountId,
              set: {
                appPassword: encryptedPassword,
                session: encryptedSession,
                updatedAt: new Date()
              }
            })
        ])
        const rows = await db
          .select()
          .from(externalAccounts)
          .where(
            and(
              eq(externalAccounts.userId, userId),
              eq(externalAccounts.provider, 'bluesky'),
              eq(externalAccounts.providerAccountId, login.did)
            )
          )
          .limit(1)
        const account = rows[0]
        if (!account) throw databaseError('connect-account')
        return account
      },
      catch: () => databaseError('connect')
    })
  })

const listEffect = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({ account: externalAccounts, scheduled: blueskySyncStates.scheduled })
          .from(externalAccounts)
          .leftJoin(blueskySyncStates, eq(blueskySyncStates.externalAccountId, externalAccounts.id))
          .where(eq(externalAccounts.userId, userId))
          .orderBy(externalAccounts.createdAt)
        return rows.map(({ account, scheduled }) => ({ ...account, scheduled: scheduled ?? false }))
      },
      catch: () => databaseError('list')
    })
  })

const setScheduledEffect = (userId: string, accountId: string, scheduled: boolean) =>
  Effect.gen(function* () {
    const db = yield* Database
    const [account] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: externalAccounts.id })
          .from(externalAccounts)
          .where(and(eq(externalAccounts.id, accountId), eq(externalAccounts.userId, userId)))
          .limit(1),
      catch: () => databaseError('schedule-account')
    })
    if (!account) return yield* new NotFoundError({ message: 'Bluesky account not found' })
    yield* Effect.tryPromise({
      try: () =>
        db
          .insert(blueskySyncStates)
          .values({ externalAccountId: accountId, scheduled })
          .onConflictDoUpdate({
            target: blueskySyncStates.externalAccountId,
            set: {
              scheduled,
              consecutiveFailures: 0,
              nextEligibleAt: null,
              updatedAt: new Date()
            }
          }),
      catch: () => databaseError('schedule')
    })
    return scheduled
  })

const disconnectEffect = (userId: string, accountId: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    const deleted = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(externalAccounts)
          .where(and(eq(externalAccounts.id, accountId), eq(externalAccounts.userId, userId)))
          .returning({ id: externalAccounts.id }),
      catch: () => databaseError('disconnect')
    })
    if (deleted.length === 0) {
      return yield* new NotFoundError({ message: 'Bluesky account not found' })
    }
    return undefined
  })

export const BlueskyAccountServiceLayer = Layer.effect(
  BlueskyAccountService,
  Effect.gen(function* () {
    const db = yield* Database
    const client = yield* BlueskyClient
    const crypto = yield* CryptoService
    const provideDb = Effect.provideService(Database, db)
    return {
      connect: (input) =>
        provideDb(connectEffect(input)).pipe(
          Effect.provideService(BlueskyClient, client),
          Effect.provideService(CryptoService, crypto)
        ),
      list: (userId) => provideDb(listEffect(userId)),
      setScheduled: (userId, accountId, scheduled) =>
        provideDb(setScheduledEffect(userId, accountId, scheduled)),
      disconnect: (userId, accountId) => provideDb(disconnectEffect(userId, accountId))
    }
  })
)
