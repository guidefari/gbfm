import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { canCreatePosts } from '@gbfm/core/roles'
import { Effect, Redacted } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { dieOnDatabaseError as makeDieOnDatabaseError } from '@/http/handler-utils'
import { BlueskyAccountService } from '@/services/bluesky-account.service'
import { BlueskySyncService } from '@/services/bluesky-sync.service'

const dieOnDatabaseError = makeDieOnDatabaseError('bluesky')

const toAccountResponse = (account: {
  id: string
  provider: 'bluesky'
  providerAccountId: string
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  status: 'active' | 'needs_reconnect' | 'revoked' | 'error'
  scheduled?: boolean
  lastSuccessfulSyncAt: Date | null
  createdAt: Date
  updatedAt: Date
}) => ({
  ...account,
  scheduled: account.scheduled ?? false,
  lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
  createdAt: account.createdAt.toISOString(),
  updatedAt: account.updatedAt.toISOString()
})

export const BlueskyHandlersLive = HttpApiBuilder.group(Api, 'bluesky', (handlers) =>
  handlers
    .handle('connectBluesky', ({ payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        if (!canCreatePosts(user.role)) {
          return yield* new HttpApiError.Forbidden()
        }
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
    .handle('syncBluesky', ({ params }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        if (!canCreatePosts(user.role)) {
          return yield* new HttpApiError.Forbidden()
        }
        const service = yield* BlueskySyncService
        const handle = yield* dieOnDatabaseError(
          service.start({ userId: user.id, accountId: params.id }).pipe(
            Effect.catchTags({
              NotFoundError: () => new HttpApiError.NotFound(),
              LockUnavailable: () => new HttpApiError.BadRequest()
            })
          )
        )
        yield* Effect.forkDetach(
          service.sync({ userId: user.id, accountId: params.id, runId: handle.runId }).pipe(
            Effect.tapError((error) =>
              Effect.logError('[bluesky] asynchronous sync failed', {
                runId: handle.runId,
                error
              })
            ),
            Effect.catch(() => Effect.void)
          )
        )
        return handle
      })
    )
    .handle('scheduleBluesky', ({ params, payload }) =>
      Effect.gen(function* () {
        const { user } = yield* AuthSession
        const service = yield* BlueskyAccountService
        const scheduled = yield* dieOnDatabaseError(
          service
            .setScheduled(user.id, params.id, payload.scheduled)
            .pipe(Effect.catchTag('NotFoundError', () => new HttpApiError.NotFound()))
        )
        return { scheduled }
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
