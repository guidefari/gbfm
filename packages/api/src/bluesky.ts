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
  scheduled: Schema.Boolean,
  lastSuccessfulSyncAt: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String
})

export const SyncRunAccepted = Schema.Struct({
  runId: Uuid,
  status: Schema.Literal('queued')
})

export const BlueskySyncRun = Schema.Struct({
  id: Uuid,
  status: Schema.Literals(['running', 'succeeded', 'failed']),
  discovered: Schema.Number,
  qualifying: Schema.Number,
  created: Schema.Number,
  alreadyImported: Schema.Number,
  conflicted: Schema.Number,
  failed: Schema.Number,
  pageCount: Schema.Number,
  errorCategory: Schema.NullOr(Schema.String),
  startedAt: Schema.String,
  finishedAt: Schema.NullOr(Schema.String)
})

export const BlueskySourceStatus = Schema.Literals([
  'active',
  'edited',
  'deleted',
  'unavailable',
  'error',
  'dismissed',
  'conflict'
])

export const BlueskyPostSource = Schema.Struct({
  id: Uuid,
  postId: Schema.NullOr(Uuid),
  postSlug: Schema.NullOr(Schema.String),
  postDraft: Schema.NullOr(Schema.Boolean),
  authorHandle: Schema.NullOr(Schema.String),
  publicUrl: Schema.String,
  sourceCreatedAt: Schema.String,
  sourceStatus: BlueskySourceStatus,
  sourceText: Schema.NullOr(Schema.String),
  locallyEdited: Schema.Boolean,
  lastError: Schema.NullOr(Schema.String)
})

const ListSourcesQuery = Schema.Struct({
  status: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.FiniteFromString),
  offset: Schema.optional(Schema.FiniteFromString)
})

const ListRunsQuery = Schema.Struct({
  limit: Schema.optional(Schema.FiniteFromString)
})

const UpdateSourceStatusInput = Schema.Struct({
  sourceStatus: Schema.Literals(['dismissed', 'active'])
})

const ScheduleBlueskyInput = Schema.Struct({ scheduled: Schema.Boolean })

const ConnectBlueskyInput = Schema.Struct({
  handle: Schema.NonEmptyString,
  appPassword: Schema.NonEmptyString
})

export const BlueskyGroup = HttpApiGroup.make('bluesky')
  .add(
    HttpApiEndpoint.post('connectBluesky', '/api/integrations/bluesky', {
      payload: ConnectBlueskyInput,
      success: BlueskyAccount,
      error: [HttpApiError.BadRequest, HttpApiError.Forbidden]
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
      success: SyncRunAccepted,
      error: [HttpApiError.BadRequest, HttpApiError.Forbidden, HttpApiError.NotFound]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.patch('scheduleBluesky', '/api/integrations/bluesky/:id/schedule', {
      params: { id: Uuid },
      payload: ScheduleBlueskyInput,
      success: Schema.Struct({ scheduled: Schema.Boolean }),
      error: HttpApiError.NotFound
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.delete('disconnectBluesky', '/api/integrations/bluesky/:id', {
      params: { id: Uuid },
      success: Schema.Struct({ success: Schema.Literal(true) }),
      error: [HttpApiError.NotFound, HttpApiError.BadRequest]
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('listBlueskySyncRuns', '/api/integrations/bluesky/:id/runs', {
      params: { id: Uuid },
      query: ListRunsQuery,
      success: Schema.Array(BlueskySyncRun),
      error: HttpApiError.NotFound
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.get('listBlueskySources', '/api/integrations/bluesky/:id/sources', {
      params: { id: Uuid },
      query: ListSourcesQuery,
      success: Schema.Array(BlueskyPostSource),
      error: HttpApiError.NotFound
    }).middleware(AuthMiddleware)
  )
  .add(
    HttpApiEndpoint.patch(
      'updateBlueskySourceStatus',
      '/api/integrations/bluesky/sources/:sourceId',
      {
        params: { sourceId: Uuid },
        payload: UpdateSourceStatusInput,
        success: Schema.Struct({ success: Schema.Literal(true) }),
        error: HttpApiError.NotFound
      }
    ).middleware(AuthMiddleware)
  )
