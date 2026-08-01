import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from 'effect/unstable/httpapi'
import { AuthMiddleware } from './middleware/auth'

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Uuid = Schema.String.pipe(Schema.check(Schema.isPattern(UuidPattern)))

export const BlueskyAccount = Schema.Struct({
  id: Uuid,
  provider: Schema.Literal('bluesky'),
  providerAccountId: Schema.String,
  handle: Schema.NullOr(Schema.String),
  displayName: Schema.NullOr(Schema.String),
  avatarUrl: Schema.NullOr(Schema.String),
  status: Schema.Literals(['active', 'needs_reconnect', 'revoked', 'error']),
  lastSuccessfulSyncAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

const SyncRunResponse = Schema.Struct({
  runId: Uuid,
  discovered: Schema.Number,
  qualifying: Schema.Number,
  created: Schema.Number,
  alreadyImported: Schema.Number,
  failed: Schema.Number,
  cursor: Schema.NullOr(Schema.String)
})

const ConnectBlueskyInput = Schema.Struct({
  handle: Schema.NonEmptyString,
  appPassword: Schema.NonEmptyString
})

export const BlueskyGroup = HttpApiGroup.make('bluesky')
  .add(
    HttpApiEndpoint.post('connectBluesky', '/api/integrations/bluesky', {
      payload: ConnectBlueskyInput,
      success: BlueskyAccount,
      error: HttpApiError.BadRequest
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('listBlueskyAccounts', '/api/integrations/bluesky', {
      success: Schema.Array(BlueskyAccount)
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.post('syncBluesky', '/api/integrations/bluesky/:id/sync', {
      params: { id: Uuid },
      success: SyncRunResponse,
      error: [HttpApiError.BadRequest, HttpApiError.NotFound]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete('disconnectBluesky', '/api/integrations/bluesky/:id', {
      params: { id: Uuid },
      success: Schema.Struct({ success: Schema.Literal(true) }),
      error: [HttpApiError.NotFound, HttpApiError.BadRequest]
    }).middleware(AuthMiddleware)
  )
