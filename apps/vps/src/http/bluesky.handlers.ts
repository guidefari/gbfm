import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect, Redacted } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { BlueskyAccountService } from '@/services/bluesky-account.service'

const dieOnDatabaseError = makeDieOnDatabaseError('bluesky')

const toAccountResponse = (account: {
  id: string
  provider: 'bluesky'
  providerAccountId: string
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  status: 'active' | 'needs_reconnect' | 'revoked' | 'error'
  lastSuccessfulSyncAt: Date | null
  createdAt: Date
  updatedAt: Date
}) => ({
  ...account,
  lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
  createdAt: account.createdAt.toISOString(),
  updatedAt: account.updatedAt.toISOString()
})

export const BlueskyHandlersLive = HttpApiBuilder.group(Api, 'bluesky', (handlers) =>
  handlers
    .handle('connectBluesky', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const service = yield* BlueskyAccountService
        const account = yield* dieOnDatabaseError(
          service
            .connect({
              userId: user.id,
              handle: payload.handle,
              appPassword: Redacted.make(payload.appPassword)
            })
            .pipe(
              Effect.catchTags({
                BlueskyProviderError: () => new HttpApiError.BadRequest(),
                IdentityResolutionError: () => new HttpApiError.BadRequest(),
                NotFoundError: () => new HttpApiError.BadRequest(),
                CryptoError: (cause) => Effect.die(cause)
              })
            )
        )
        return toAccountResponse(account)
      })
    )
    .handle('listBlueskyAccounts', () =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const service = yield* BlueskyAccountService
        const accounts = yield* dieOnDatabaseError(service.list(user.id))
        return accounts.map(toAccountResponse)
      })
    )
    .handle('disconnectBluesky', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const service = yield* BlueskyAccountService
        yield* dieOnDatabaseError(
          service
            .disconnect(user.id, params.id)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return { success: true as const }
      })
    )
)
