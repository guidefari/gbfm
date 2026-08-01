import { and, eq } from 'drizzle-orm'
import { Context, Effect, Layer, Redacted } from 'effect'
import { db } from '@/db'
import {
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
  ) => Effect.Effect<ReadonlyArray<SelectExternalAccount>, DatabaseError>
  readonly disconnect: (
    userId: string,
    accountId: string
  ) => Effect.Effect<void, DatabaseError | NotFoundError>
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

const makeService = (client: BlueskyClient, crypto: CryptoService): BlueskyAccountService => ({
  connect: ({ userId, handle, appPassword }) =>
    Effect.gen(function* () {
      const login = yield* client.login({ handle, appPassword })
      const encryptedPassword = yield* crypto.encrypt(appPassword)
      const encryptedSession = yield* crypto.encrypt(
        Redacted.make(sessionPayload({ accessJwt: login.accessJwt, refreshJwt: login.refreshJwt }))
      )

      return yield* Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const [account] = await tx
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
              })
              .returning()
            if (!account) throw databaseError('connect-account')

            await tx
              .insert(externalAccountSessions)
              .values({
                externalAccountId: account.id,
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
            return account
          }),
        catch: () => databaseError('connect')
      })
    }),
  list: (userId) =>
    Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(externalAccounts)
          .where(eq(externalAccounts.userId, userId))
          .orderBy(externalAccounts.createdAt),
      catch: () => databaseError('list')
    }),
  disconnect: (userId, accountId) =>
    Effect.gen(function* () {
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
    })
})

export const BlueskyAccountServiceLayer = Layer.effect(
  BlueskyAccountService,
  Effect.gen(function* () {
    return makeService(yield* BlueskyClient, yield* CryptoService)
  })
)
