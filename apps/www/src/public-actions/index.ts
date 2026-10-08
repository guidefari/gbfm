import { Effect, Match, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import type { HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'

import { iconPaths, lucide } from '../view/icons'

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
  Message.match<Update.Return<Model, Message>>(message, {
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
  iconOnly = false,
) => {
  const document = model.document

  if (!document) return h.empty
  const active = document.state === 'active'

  const label = Match.value(document.target.kind).pipe(
    Match.when('show', () => (active ? 'Unsubscribe' : 'Subscribe')),
    Match.orElse(() => (active ? 'Remove from favorites' : 'Add to favorites')),
  )

  const signInLabel = `Sign in to ${document.target.kind === 'show' ? 'subscribe' : 'favorite'}`

  const icon = lucide(
    document.target.kind === 'show' ? iconPaths.rss : iconPaths.heart,
    `h-5 w-5 ${active ? 'fill-current' : ''}`,
  )

  const iconButton =
    'inline-flex h-11 w-11 items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 aria-pressed:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  const outlineButton =
    'inline-flex h-10 items-center gap-2 rounded-sm border border-border bg-transparent px-4 text-sm font-semibold text-foreground no-underline transition-colors hover:border-foreground hover:bg-muted disabled:opacity-50 aria-pressed:border-highlight aria-pressed:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return h.div(
    [h.Class('flex flex-wrap items-center gap-3')],
    [
      Match.value(document.state).pipe(
        Match.when('anonymous', () =>
          h.a(
            [
              h.Href(`/auth/sign-in?returnTo=${encodeURIComponent(document.path)}`),
              ...(iconOnly ? [h.AriaLabel(signInLabel), h.Title(signInLabel)] : []),
              h.Class(iconOnly ? iconButton : outlineButton),
            ],
            [iconOnly ? icon : signInLabel],
          ),
        ),
        Match.when('unavailable', () =>
          h.p(
            [h.Role('status'), h.Class('text-sm text-muted-foreground')],
            ['Your saved state is unavailable. Reload to try again.'],
          ),
        ),
        Match.orElse(() =>
          h.button(
            [
              h.Type('button'),
              h.Disabled(model.busy || !interactive),
              h.AriaPressed(String(active)),
              h.OnClick(message(Message.Toggle())),
              ...(iconOnly ? [h.AriaLabel(label), h.Title(label)] : []),
              h.Class(iconOnly ? iconButton : outlineButton),
            ],
            [iconOnly ? icon : model.busy ? 'Saving…' : label],
          ),
        ),
      ),
      model.notice
        ? h.p([h.Role('status'), h.Class('text-sm text-muted-foreground')], [model.notice])
        : h.empty,
    ],
  )
}
