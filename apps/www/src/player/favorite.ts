import { AudioPageResponse } from '@gbfm/api/audio'
import { QueueTrack, type QueueTrackType } from '@gbfm/player'
import { Effect, Match, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import type { HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'

import { iconPaths, lucide } from '../view/icons'

const Track = Schema.Struct({
  audioId: Schema.String,
  type: QueueTrack.fields.type,
  slug: Schema.String,
})

type Track = typeof Track.Type

export const Status = Schema.Literals([
  'idle',
  'loading',
  'anonymous',
  'active',
  'inactive',
  'unavailable',
])

export const Model = Schema.Struct({
  track: Schema.NullOr(Track),
  principalId: Schema.NullOr(Schema.String),
  principalKnown: Schema.Boolean,
  generation: Schema.Number,
  status: Status,
  saving: Schema.Boolean,
  notice: Schema.NullOr(Schema.String),
  noticeId: Schema.Number,
})

export type Model = typeof Model.Type

export const initialModel: Model = {
  track: null,
  principalId: null,
  principalKnown: false,
  generation: 0,
  status: 'idle',
  saving: false,
  notice: null,
  noticeId: 0,
}

const LoadedState = Schema.Literals(['anonymous', 'active', 'inactive', 'unavailable'])

export const Message = defineMessageUnion({
  Loaded: {
    generation: Schema.Number,
    state: LoadedState,
    principalId: Schema.NullOr(Schema.String),
    principalKnown: Schema.Boolean,
  },
  Toggled: {},
  Retried: {},
  Saved: {
    generation: Schema.Number,
    audioId: Schema.String,
    active: Schema.Boolean,
    principalId: Schema.String,
  },
  SaveFailed: {
    generation: Schema.Number,
    unauthorized: Schema.Boolean,
    principalId: Schema.String,
  },
  NoticeDismissed: { generation: Schema.Number, noticeId: Schema.Number },
})

export type Message = typeof Message.Type

const DismissNotice = Command.define('PlayerFavorite.DismissNotice', {
  args: { generation: Schema.Number, noticeId: Schema.Number },
  messages: [Message.NoticeDismissed],
  execute: ({ generation, noticeId }) =>
    Effect.sleep('4 seconds').pipe(Effect.as(Message.NoticeDismissed({ generation, noticeId }))),
})

const notify = (model: Model, notice: string): Update.Return<Model, Message> => {
  const noticeId = model.noticeId + 1

  return {
    model: { ...model, notice, noticeId },
    commands: [DismissNotice({ generation: model.generation, noticeId })],
  }
}

const Load = Command.define('PlayerFavorite.Load', {
  args: { generation: Schema.Number, track: Track },
  messages: [Message.Loaded],
  execute: ({ generation, track }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(
        `/api/content/audio/${track.type}/${encodeURIComponent(track.slug)}/page`,
        { credentials: 'same-origin', signal },
      )

      if (!response.ok) throw new Error('Favorite status unavailable')

      return response.json()
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(AudioPageResponse)),
      Effect.map((page) =>
        Message.Loaded({
          generation,
          principalId: page.principal?.id ?? null,
          principalKnown: true,
          state:
            AudioPageResponse.guards.Ready(page) && page.audio.id === track.audioId
              ? page.favorite
              : 'unavailable',
        }),
      ),
      Effect.orElseSucceed(() =>
        Message.Loaded({
          generation,
          state: 'unavailable',
          principalId: null,
          principalKnown: false,
        }),
      ),
    ),
})

const Save = Command.define('PlayerFavorite.Save', {
  args: {
    generation: Schema.Number,
    audioId: Schema.String,
    active: Schema.Boolean,
    principalId: Schema.String,
  },
  messages: [Message.Saved, Message.SaveFailed],
  execute: ({ generation, audioId, active, principalId }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(
        active ? '/api/favorites' : `/api/favorites/${encodeURIComponent(audioId)}`,
        {
          method: active ? 'POST' : 'DELETE',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: active ? JSON.stringify({ audioId }) : undefined,
          signal,
        },
      )

      const settled = response.ok || response.status === (active ? 409 : 404)

      return settled
        ? Message.Saved({ generation, audioId, active, principalId })
        : Message.SaveFailed({ generation, unauthorized: response.status === 401, principalId })
    }).pipe(
      Effect.orElseSucceed(() =>
        Message.SaveFailed({ generation, unauthorized: false, principalId }),
      ),
    ),
})

const sameTrack = (left: Track | null, right: Track | null) =>
  left?.audioId === right?.audioId && left?.type === right?.type && left?.slug === right?.slug

const trackOf = (current: QueueTrackType | null): Track | null =>
  current?.slug ? { audioId: current.id, type: current.type, slug: current.slug } : null

const load = (model: Model): Update.Return<Model, Message> => {
  const generation = model.generation + 1
  const reset = { ...model, generation, saving: false, notice: null }

  if (!model.track) return { model: { ...reset, status: 'idle' } }

  return {
    model: { ...reset, status: 'loading' },
    commands: [Load({ generation, track: model.track })],
  }
}

/** Resets favorite state whenever the playing track or signed-in account changes. */
export const sync = (
  model: Model,
  current: QueueTrackType | null,
  principalId: string | null,
  principalKnown = principalId !== null || model.principalKnown,
): Update.Return<Model, Message> => {
  const track = trackOf(current)

  return sameTrack(model.track, track) &&
    model.principalId === principalId &&
    model.principalKnown === principalKnown
    ? { model }
    : load({ ...model, track, principalId, principalKnown })
}

/** Adopts a server-acknowledged favorite change made by another control for the same audio. */
export const reconcile = (model: Model, audioId: string, active: boolean): Model =>
  model.track?.audioId !== audioId ||
  model.saving ||
  !['loading', 'active', 'inactive'].includes(model.status)
    ? model
    : {
        ...model,
        generation: model.generation + 1,
        status: active ? 'active' : 'inactive',
        notice: null,
      }

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    Loaded: ({ generation, state, principalId, principalKnown }) => {
      if (generation !== model.generation || model.status !== 'loading') return { model }

      const identified = {
        ...model,
        principalId: principalKnown ? principalId : model.principalId,
        principalKnown: principalKnown || model.principalKnown,
      }

      return state === 'unavailable'
        ? notify({ ...identified, status: state }, 'Favorite status could not be loaded.')
        : { model: { ...identified, status: state, notice: null } }
    },
    NoticeDismissed: ({ generation, noticeId }) =>
      generation === model.generation && noticeId === model.noticeId && model.notice !== null
        ? { model: { ...model, notice: null } }
        : { model },
    Retried: () => (model.status === 'unavailable' ? load(model) : { model }),
    Toggled: () => {
      if (
        !model.track ||
        !model.principalId ||
        model.saving ||
        !['active', 'inactive'].includes(model.status)
      )
        return { model }

      return {
        model: { ...model, saving: true, notice: null },
        commands: [
          Save({
            generation: model.generation,
            audioId: model.track.audioId,
            active: model.status !== 'active',
            principalId: model.principalId,
          }),
        ],
      }
    },
    Saved: ({ generation, active, principalId, audioId }) =>
      generation !== model.generation ||
      principalId !== model.principalId ||
      audioId !== model.track?.audioId ||
      !model.saving
        ? { model }
        : { model: { ...model, saving: false, status: active ? 'active' : 'inactive' } },
    SaveFailed: ({ generation, unauthorized, principalId }) =>
      generation !== model.generation || principalId !== model.principalId || !model.saving
        ? { model }
        : notify(
            {
              ...model,
              saving: false,
              status: unauthorized ? 'anonymous' : model.status,
              principalId: unauthorized ? null : model.principalId,
              principalKnown: unauthorized || model.principalKnown,
            },
            unauthorized
              ? 'Your session has ended. Sign in to favorite.'
              : 'Favorite could not be saved. Try again.',
          ),
  })

const heartButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-[0.75rem] border-0 bg-transparent p-0 text-muted-foreground no-underline transition-[transform,background-color,color] hover:bg-foreground/10 hover:text-foreground active:scale-90 aria-pressed:text-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

export const button = <M>(
  model: Model,
  h: HtmlBuilder<M>,
  toMessage: (message: Message) => M,
  returnTo: string,
) => {
  const heart = (filled: boolean) =>
    lucide(
      iconPaths.heart,
      `size-6 [stroke-linecap:square] [stroke-linejoin:miter] ${filled ? 'fill-current' : ''}`,
    )

  return Match.value(model.status).pipe(
    Match.when('idle', () => h.empty),
    Match.when('anonymous', () =>
      h.a(
        [
          h.Href(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`),
          h.AriaLabel('Sign in to favorite'),
          h.Title('Sign in to favorite'),
          h.Class(heartButton),
        ],
        [heart(false)],
      ),
    ),
    Match.when('loading', () =>
      h.button(
        [
          h.Type('button'),
          h.Disabled(true),
          h.AriaBusy(true),
          h.AriaLabel('Checking favorite'),
          h.Class(heartButton),
        ],
        [heart(false)],
      ),
    ),
    Match.when('unavailable', () =>
      h.button(
        [
          h.Type('button'),
          h.OnClick(toMessage(Message.Retried())),
          h.AriaLabel('Retry loading favorite'),
          h.Title('Retry loading favorite'),
          h.Class(heartButton),
        ],
        [heart(false)],
      ),
    ),
    Match.whenOr('active', 'inactive', (status) => {
      const active = status === 'active'
      const label = active ? 'Remove from favorites' : 'Add to favorites'

      return h.button(
        [
          h.Type('button'),
          h.Disabled(model.saving),
          h.AriaBusy(model.saving),
          h.AriaPressed(String(active)),
          h.OnClick(toMessage(Message.Toggled())),
          h.AriaLabel(label),
          h.Title(label),
          h.Class(heartButton),
        ],
        [heart(active)],
      )
    }),
    Match.exhaustive,
  )
}

export const notice = <M>(model: Model, h: HtmlBuilder<M>, toMessage: (message: Message) => M) =>
  model.notice
    ? h.div(
        [
          h.Key(`favorite-notice-${model.generation}-${model.noticeId}`),
          h.Role('status'),
          h.AriaLive('polite'),
          h.AriaAtomic(true),
          h.Class(
            'absolute inset-x-0 bottom-full z-10 mb-3 flex items-center gap-2 rounded border border-highlight/40 border-l-2 bg-background pl-4 text-sm text-foreground shadow-lg',
          ),
        ],
        [
          h.span([h.Class('min-w-0 flex-1 py-3')], [model.notice]),
          h.button(
            [
              h.Type('button'),
              h.AriaLabel('Dismiss favorite notice'),
              h.OnClick(
                toMessage(
                  Message.NoticeDismissed({
                    generation: model.generation,
                    noticeId: model.noticeId,
                  }),
                ),
              ),
              h.Class(
                'inline-flex size-11 shrink-0 items-center justify-center text-foreground hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              ),
            ],
            [lucide(iconPaths.close, 'size-4')],
          ),
        ],
      )
    : h.empty
