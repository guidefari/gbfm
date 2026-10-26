import { spotifyEntityFromUrl } from '@gbfm/spotify/entity'
import { Effect, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import type { HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'

import { disconnected, SpotifyConnection, SpotifyStatus } from './connection'

export const Model = Schema.Struct({
  status: Schema.NullOr(SpotifyStatus),
  busy: Schema.Boolean,
  target: Schema.NullOr(Schema.String),
  notice: Schema.String,
})

export type Model = typeof Model.Type

export const initialModel: Model = { status: null, busy: false, target: null, notice: '' }

export const Message = defineMessageUnion({
  Requested: { action: Schema.Literals(['connect', 'play', 'queue']), url: Schema.String },
  Loaded: { status: SpotifyStatus },
  Completed: { notice: Schema.String },
})

export type Message = typeof Message.Type

export const Load = Command.define('Spotify.PlaybackStatus', {
  messages: [Message.Loaded],
  execute: SpotifyConnection.pipe(
    Effect.flatMap((service) => service.status),
    Effect.orElseSucceed(() => disconnected),
    Effect.map((status) => Message.Loaded({ status })),
  ),
})

const Request = Command.define('Spotify.Playback', {
  args: { action: Schema.Literals(['connect', 'play', 'queue']), url: Schema.String },
  messages: [Message.Completed],
  execute: ({ action, url }) =>
    SpotifyConnection.pipe(
      Effect.flatMap((service) =>
        action === 'connect'
          ? service.connect.pipe(Effect.as(''))
          : service.playback({ action, url }),
      ),
      Effect.catch((error) => Effect.succeed(error.message)),
      Effect.map((notice) => Message.Completed({ notice })),
    ),
})

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message, SpotifyConnection> =>
  Message.match<Update.Return<Model, Message, SpotifyConnection>>(message, {
    Requested: ({ action, url }) =>
      model.busy
        ? { model }
        : {
            model: { ...model, busy: true, target: url, notice: '' },
            commands: [Request({ action, url })],
          },
    Loaded: ({ status }) => ({ model: { ...model, status } }),
    Completed: ({ notice }) => ({ model: { ...model, busy: false, notice } }),
  })

export const view = <M>(
  model: Model,
  h: HtmlBuilder<M>,
  toMessage: (message: Message) => M,
  url: string,
  interactive: boolean,
) => {
  if (!spotifyEntityFromUrl(url)) return h.empty
  const connected = model.status?.connected

  const button = (action: 'connect' | 'play' | 'queue', label: string) =>
    h.button(
      [
        h.Type('button'),
        h.Disabled(!interactive || model.status === null || model.busy),
        h.OnClick(toMessage(Message.Requested({ action, url }))),
        h.AriaBusy(model.busy && model.target === url),
        h.Class(action === 'play' ? 'btn btn-primary' : 'btn'),
      ],
      [label],
    )

  return h.div(
    [h.Class('relative z-10 space-y-2 border-t border-border/40 px-4 py-3')],
    [
      h.div(
        [h.Class('flex flex-wrap gap-2')],
        connected
          ? [button('play', 'Play on Spotify'), button('queue', 'Queue on Spotify')]
          : [button('connect', 'Connect Spotify')],
      ),
      h.p(
        [h.Class('text-xs text-muted-foreground')],
        [
          'Spotify Premium and an active Spotify device required. Audio plays in Spotify, not the mix player.',
        ],
      ),
      h.p(
        [h.Role('status'), h.Class('text-xs text-muted-foreground')],
        [model.target === url ? (model.busy ? 'Working…' : model.notice) : ''],
      ),
    ],
  )
}
