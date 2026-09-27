import { Effect, Match, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import type { HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'

export const Target = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(['audio', 'show']),
})

export const Document = Schema.Struct({
  target: Target,
  path: Schema.String,
  state: Schema.Literals(['anonymous', 'active', 'inactive', 'unavailable']),
})

export type Document = typeof Document.Type

export const Model = Schema.Struct({
  document: Schema.NullOr(Document),
  busy: Schema.Boolean,
  notice: Schema.NullOr(Schema.String),
})

export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  Toggle: {},
  Saved: { target: Target, active: Schema.Boolean },
  Failed: { target: Target, unauthorized: Schema.Boolean },
})

export type Message = typeof Message.Type

const Save = Command.define('PublicActions.Save', {
  args: { target: Target, active: Schema.Boolean },
  messages: [Message.Saved, Message.Failed],
  execute: ({ target, active }) =>
    Effect.tryPromise(async (signal) => {
      const path =
        target.kind === 'show'
          ? `/api/shows/${encodeURIComponent(target.id)}/${active ? 'subscribe' : 'unsubscribe'}`
          : active
            ? '/api/favorites'
            : `/api/favorites/${encodeURIComponent(target.id)}`

      const response = await fetch(path, {
        method: active ? 'POST' : 'DELETE',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body:
          target.kind === 'audio' && active ? JSON.stringify({ audioId: target.id }) : undefined,
        signal,
      })

      return response.ok
        ? Message.Saved({ target, active })
        : Message.Failed({ target, unauthorized: response.status === 401 })
    }).pipe(Effect.orElseSucceed(() => Message.Failed({ target, unauthorized: false }))),
})

export const init = (document: Document | null): Model => ({ document, busy: false, notice: null })

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    Toggle: () =>
      !model.document || model.busy || !['active', 'inactive'].includes(model.document.state)
        ? { model }
        : {
            model: { ...model, busy: true, notice: null },
            commands: [
              Save({ target: model.document.target, active: model.document.state !== 'active' }),
            ],
          },
    Saved: ({ target, active }) =>
      model.document?.target.id !== target.id || model.document.target.kind !== target.kind
        ? { model }
        : {
            model: {
              ...model,
              busy: false,
              document: { ...model.document, state: active ? 'active' : 'inactive' },
              notice: 'Saved',
            },
          },
    Failed: ({ target, unauthorized }) =>
      model.document?.target.id !== target.id || model.document.target.kind !== target.kind
        ? { model }
        : {
            model: {
              ...model,
              busy: false,
              document: {
                ...model.document,
                state: unauthorized ? 'anonymous' : model.document.state,
              },
              notice: unauthorized ? 'Sign in to continue.' : 'Action failed. Please try again.',
            },
          },
  })

export const view = <M>(
  model: Model,
  h: HtmlBuilder<M>,
  message: (message: Message) => M,
  interactive: boolean,
) => {
  const document = model.document

  if (!document) return h.empty
  const active = document.state === 'active'

  const label = Match.value(document.target.kind).pipe(
    Match.when('show', () => (active ? 'Unsubscribe' : 'Subscribe')),
    Match.orElse(() => (active ? 'Remove from favorites' : 'Add to favorites')),
  )

  return h.div(
    [h.Class('detail-actions')],
    [
      Match.value(document.state).pipe(
        Match.when('anonymous', () =>
          h.a(
            [h.Href(`/auth/sign-in?returnTo=${encodeURIComponent(document.path)}`)],
            [`Sign in to ${document.target.kind === 'show' ? 'subscribe' : 'favorite'}`],
          ),
        ),
        Match.when('unavailable', () =>
          h.p([h.Role('status')], ['Your saved state is unavailable. Reload to try again.']),
        ),
        Match.orElse(() =>
          h.button(
            [
              h.Type('button'),
              h.Disabled(model.busy || !interactive),
              h.AriaPressed(String(active)),
              h.OnClick(message(Message.Toggle())),
            ],
            [model.busy ? 'Saving…' : label],
          ),
        ),
      ),
      model.notice ? h.p([h.Role('status')], [model.notice]) : h.empty,
    ],
  )
}
