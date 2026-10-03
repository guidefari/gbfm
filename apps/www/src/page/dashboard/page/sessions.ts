import { Context, Data, Effect, Layer, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { defineView } from 'foldkit/submodel'

const User = Schema.Struct({ id: Schema.String, name: Schema.String, email: Schema.String })

const Session = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  expiresAt: Schema.String,
  userAgent: Schema.NullOr(Schema.String),
  ipAddress: Schema.NullOr(Schema.String),
})

const SessionResponse = Schema.Struct({
  sessions: Schema.Array(
    Schema.Struct({
      ...Session.fields,
      token: Schema.String,
      userId: Schema.String,
    }),
  ),
})

class SessionRequestError extends Data.TaggedError('SessionRequestError')<{
  readonly message: string
}> {}

export class SessionService extends Context.Service<
  SessionService,
  {
    readonly search: (
      query: string,
    ) => Effect.Effect<ReadonlyArray<typeof User.Type>, SessionRequestError>
    readonly list: (
      userId: string,
    ) => Effect.Effect<ReadonlyArray<typeof Session.Type>, SessionRequestError>
    readonly revoke: (
      userId: string,
      sessionId: string | null,
    ) => Effect.Effect<void, SessionRequestError>
  }
>()('@gbfm/www/AdminSessions') {}

const authRequest = <A>(
  schema: Schema.Codec<A, unknown, never, unknown>,
  path: string,
  body?: Schema.Json,
) =>
  Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(`/auth/admin/${path}`, {
        credentials: 'same-origin',
        signal,
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

      if (!response.ok)
        throw new SessionRequestError({
          message:
            response.status === 403
              ? 'Administrator access required.'
              : 'The session request failed. Try again.',
        })

      return response.json()
    },
    catch: () => new SessionRequestError({ message: 'The session request failed. Try again.' }),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(
      () => new SessionRequestError({ message: 'Could not complete the session request.' }),
    ),
  )

export const SessionServiceLive = Layer.sync(SessionService, () => {
  // Session bearer tokens never enter Foldkit models, messages, SSR, or tracing attributes.
  const tokens = new Map<string, { readonly userId: string; readonly token: string }>()

  return SessionService.of({
    search: (query) =>
      authRequest(
        Schema.Struct({ users: Schema.Array(User) }),
        `list-users?${new URLSearchParams({ limit: '5', searchField: 'email', searchValue: query })}`,
      ).pipe(
        Effect.map(({ users }) => users),
        Effect.withSpan('AdminSessions.search'),
      ),
    list: (userId) =>
      authRequest(SessionResponse, 'list-user-sessions', { userId }).pipe(
        Effect.map(({ sessions }) => {
          tokens.clear()

          return sessions.map(({ token, userId: owner, ...session }) => {
            tokens.set(session.id, { userId: owner, token })

            return session
          })
        }),
        Effect.withSpan('AdminSessions.list'),
      ),
    revoke: (userId, sessionId) =>
      Effect.gen(function* () {
        if (sessionId === null) {
          yield* authRequest(Schema.Json, 'revoke-user-sessions', { userId })
        } else {
          const session = tokens.get(sessionId)

          if (!session || session.userId !== userId)
            return yield* new SessionRequestError({
              message: 'Refresh the session list before revoking access.',
            })
          yield* authRequest(Schema.Json, 'revoke-user-session', { sessionToken: session.token })
        }

        tokens.clear()

        return undefined
      }).pipe(Effect.withSpan('AdminSessions.revoke')),
  })
})

export const Model = Schema.Struct({
  query: Schema.String,
  users: Schema.Array(User),
  selected: Schema.NullOr(User),
  sessions: Schema.Array(Session),
  revision: Schema.Number,
  phase: Schema.Literals(['ready', 'loading', 'revoking']),
  error: Schema.NullOr(Schema.String),
  notice: Schema.NullOr(Schema.String),
  confirming: Schema.Boolean,
})

export type Model = typeof Model.Type

export const initialModel: Model = {
  query: '',
  users: [],
  selected: null,
  sessions: [],
  revision: 0,
  phase: 'ready',
  error: null,
  notice: null,
  confirming: false,
}

export const Message = defineMessageUnion({
  QueryChanged: { query: Schema.String },
  SearchRequested: {},
  UsersLoaded: { revision: Schema.Number, users: Schema.Array(User) },
  UserSelected: { user: User },
  Clear: {},
  Refresh: {},
  SessionsLoaded: {
    revision: Schema.Number,
    sessions: Schema.Array(Session),
    revoked: Schema.Boolean,
  },
  Revoke: { sessionId: Schema.NullOr(Schema.String) },
  ConfirmAll: {},
  CancelConfirmation: {},
  Failed: { revision: Schema.Number, message: Schema.String },
})

export type Message = typeof Message.Type

const Search = Command.define('AdminSessions.Search', {
  args: { query: Schema.String, revision: Schema.Number },
  messages: [Message.UsersLoaded, Message.Failed],
  execute: ({ query, revision }) =>
    Effect.flatMap(SessionService, (service) => service.search(query)).pipe(
      Effect.map((users) => Message.UsersLoaded({ users, revision })),
      Effect.catch((error) => Effect.succeed(Message.Failed({ revision, message: error.message }))),
    ),
})

const Load = Command.define('AdminSessions.Load', {
  args: { userId: Schema.String, revision: Schema.Number },
  messages: [Message.SessionsLoaded, Message.Failed],
  execute: ({ userId, revision }) =>
    Effect.flatMap(SessionService, (service) => service.list(userId)).pipe(
      Effect.map((sessions) => Message.SessionsLoaded({ sessions, revision, revoked: false })),
      Effect.catch((error) => Effect.succeed(Message.Failed({ revision, message: error.message }))),
    ),
})

const Revoke = Command.define('AdminSessions.Revoke', {
  args: { userId: Schema.String, sessionId: Schema.NullOr(Schema.String), revision: Schema.Number },
  messages: [Message.SessionsLoaded, Message.Failed],
  execute: ({ userId, sessionId, revision }) =>
    Effect.gen(function* () {
      const service = yield* SessionService
      yield* service.revoke(userId, sessionId)
      const sessions = yield* service.list(userId)

      return Message.SessionsLoaded({ sessions, revision, revoked: true })
    }).pipe(
      Effect.catch((error) => Effect.succeed(Message.Failed({ revision, message: error.message }))),
    ),
})

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message, SessionService> =>
  Message.match<Update.Return<Model, Message, SessionService>>(message, {
    QueryChanged: ({ query }) => ({
      model: { ...initialModel, query, revision: model.revision + 1 },
    }),
    SearchRequested: () =>
      model.query.trim().length < 3
        ? { model }
        : {
            model: {
              ...model,
              revision: model.revision + 1,
              phase: 'loading',
              selected: null,
              sessions: [],
              error: null,
            },
            commands: [Search({ query: model.query.trim(), revision: model.revision + 1 })],
          },
    UsersLoaded: ({ revision, users }) => ({
      model: revision === model.revision ? { ...model, users, phase: 'ready' } : model,
    }),
    UserSelected: ({ user }) => ({
      model: {
        ...model,
        revision: model.revision + 1,
        selected: user,
        users: [],
        sessions: [],
        phase: 'loading',
        error: null,
        notice: null,
      },
      commands: [Load({ userId: user.id, revision: model.revision + 1 })],
    }),
    Clear: () => ({ model: { ...initialModel, revision: model.revision + 1 } }),
    Refresh: () =>
      model.selected
        ? {
            model: { ...model, phase: 'loading', error: null, revision: model.revision + 1 },
            commands: [Load({ userId: model.selected.id, revision: model.revision + 1 })],
          }
        : { model },
    SessionsLoaded: ({ revision, sessions, revoked }) => ({
      model:
        revision === model.revision
          ? {
              ...model,
              sessions,
              phase: 'ready',
              confirming: false,
              error: null,
              notice: revoked ? 'Session access revoked.' : null,
            }
          : model,
    }),
    Revoke: ({ sessionId }) =>
      model.selected && model.phase === 'ready' && (sessionId !== null || model.confirming)
        ? {
            model: { ...model, phase: 'revoking', error: null, notice: null },
            commands: [Revoke({ userId: model.selected.id, sessionId, revision: model.revision })],
          }
        : { model },
    ConfirmAll: () => ({ model: { ...model, confirming: true } }),
    CancelConfirmation: () => ({ model: { ...model, confirming: false } }),
    Failed: ({ revision, message }) => ({
      model: revision === model.revision ? { ...model, phase: 'ready', error: message } : model,
    }),
  })

export const view = defineView<Model, Message>((model, h) =>
  h.section(
    [h.Class('dashboard-panel dashboard-form')],
    [
      h.h2([], ['Session access']),
      h.form(
        [h.OnSubmit(Message.SearchRequested())],
        [
          h.label(
            [],
            [
              'Search user by email',
              h.input([
                h.Type('search'),
                h.Value(model.query),
                h.OnInput((query) => Message.QueryChanged({ query })),
              ]),
            ],
          ),
          h.button(
            [
              h.Type('submit'),
              h.Disabled(model.query.trim().length < 3 || model.phase !== 'ready'),
            ],
            ['Search users'],
          ),
        ],
      ),
      model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
      model.notice ? h.p([h.Role('status')], [model.notice]) : h.empty,
      model.phase !== 'ready'
        ? h.p([h.Role('status')], [model.phase === 'revoking' ? 'Revoking access…' : 'Loading…'])
        : h.empty,
      ...model.users.map((user) =>
        h.button([h.OnClick(Message.UserSelected({ user }))], [`${user.name} · ${user.email}`]),
      ),
      !model.selected && model.users.length === 0
        ? h.p([], ['Search for a user to inspect active sessions.'])
        : h.empty,
      model.selected
        ? h.div(
            [],
            [
              h.h3([], [`Sessions for ${model.selected.name}`]),
              h.p([], [model.selected.email]),
              h.div(
                [h.Class('creator-actions')],
                [
                  h.button(
                    [h.OnClick(Message.Clear()), h.Disabled(model.phase !== 'ready')],
                    ['Clear selection'],
                  ),
                  h.button(
                    [h.OnClick(Message.Refresh()), h.Disabled(model.phase !== 'ready')],
                    ['Refresh sessions'],
                  ),
                  h.button(
                    [
                      h.OnClick(Message.ConfirmAll()),
                      h.Disabled(model.phase !== 'ready' || model.sessions.length === 0),
                    ],
                    ['Revoke all'],
                  ),
                ],
              ),
              model.confirming
                ? h.div(
                    [h.Role('alert'), h.Class('dashboard-panel')],
                    [
                      h.p(
                        [],
                        [
                          `Revoke all sessions for ${model.selected.name}? They will need to sign in again.`,
                        ],
                      ),
                      h.button(
                        [
                          h.OnClick(Message.Revoke({ sessionId: null })),
                          h.Disabled(model.phase !== 'ready'),
                        ],
                        ['Confirm revoke all'],
                      ),
                      h.button(
                        [
                          h.OnClick(Message.CancelConfirmation()),
                          h.Disabled(model.phase !== 'ready'),
                        ],
                        ['Keep sessions'],
                      ),
                    ],
                  )
                : h.empty,
              model.sessions.length === 0 && model.phase === 'ready'
                ? h.p([], ['No active sessions found.'])
                : h.empty,
              h.ul(
                [h.Class('dashboard-list session-list')],
                model.sessions.map((session) =>
                  h.li(
                    [h.Key(session.id)],
                    [
                      h.div(
                        [],
                        [
                          h.strong([], [`Session ${session.id.slice(0, 8)}`]),
                          h.small([], [`Created: ${session.createdAt}`]),
                          h.small([], [`Expires: ${session.expiresAt}`]),
                          h.small([], [`Device: ${session.userAgent ?? 'Unknown'}`]),
                          h.small([], [`IP: ${session.ipAddress ?? '—'}`]),
                        ],
                      ),
                      h.button(
                        [
                          h.OnClick(Message.Revoke({ sessionId: session.id })),
                          h.Disabled(model.phase !== 'ready'),
                        ],
                        ['Revoke session'],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          )
        : h.empty,
    ],
  ),
)
