import {
  CreatePlaylistInput,
  PlaylistListResponse,
  type PlaylistResponse,
  PlaylistTrackEntry,
  UpdatePlaylistInput,
} from '@gbfm/api/music'
import { Effect, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { defineView } from 'foldkit/submodel'

import { DashboardRequestError, DashboardService, type DashboardRequest } from '../service'

const fields = [
  'title',
  'slug',
  'description',
  'coverImageUrl',
  'curatorId',
  'publishedAt',
] as const

const Field = Schema.Literals(fields)

const Form = Schema.Struct({
  title: Schema.String,
  slug: Schema.String,
  description: Schema.String,
  coverImageUrl: Schema.String,
  curatorId: Schema.String,
  publishedAt: Schema.String,
})

const emptyForm: typeof Form.Type = {
  title: '',
  slug: '',
  description: '',
  coverImageUrl: '',
  curatorId: '',
  publishedAt: '',
}

const Tracks = Schema.Array(PlaylistTrackEntry)

export const Model = Schema.Struct({
  listing: PlaylistListResponse,
  selected: Schema.NullOr(Schema.String),
  form: Form,
  tracks: Tracks,
  importUrl: Schema.String,
  trackUrl: Schema.String,
  busy: Schema.Boolean,
  deleting: Schema.Boolean,
  error: Schema.NullOr(Schema.String),
  notice: Schema.String,
})

export type Model = typeof Model.Type

export const initialModel: Model = {
  listing: [],
  selected: null,
  form: emptyForm,
  tracks: [],
  importUrl: '',
  trackUrl: '',
  busy: false,
  deleting: false,
  error: null,
  notice: '',
}

export const Message = defineMessageUnion({
  FieldChanged: { field: Field, value: Schema.String },
  ImportUrlChanged: { value: Schema.String },
  TrackUrlChanged: { value: Schema.String },
  Select: { id: Schema.String },
  New: {},
  Save: {},
  Import: {},
  AddTrack: {},
  RemoveTrack: { id: Schema.String },
  MoveTrack: { id: Schema.String, direction: Schema.Literals(['up', 'down']) },
  Sync: {},
  AskDelete: {},
  CancelDelete: {},
  ConfirmDelete: {},
  Refresh: {},
  Loaded: { listing: PlaylistListResponse, tracks: Tracks, resetForm: Schema.Boolean },
  Saved: {
    selected: Schema.NullOr(Schema.String),
    notice: Schema.String,
    resetForm: Schema.Boolean,
  },
  Failed: { message: Schema.String },
})

export type Message = typeof Message.Type

type Result = Update.Return<Model, Message, DashboardService>

const pathFor = (id: string) => `/api/music/playlists/${encodeURIComponent(id)}`

const formFor = (playlist: PlaylistResponse): typeof Form.Type => ({
  title: playlist.title,
  slug: playlist.slug,
  description: playlist.description ?? '',
  coverImageUrl: playlist.coverImageUrl ?? '',
  curatorId: playlist.curatorId ?? '',
  publishedAt: playlist.publishedAt ?? '',
})

const Load = Command.define('Playlists.Load', {
  args: { selected: Schema.NullOr(Schema.String), resetForm: Schema.Boolean },
  messages: [Message.Loaded, Message.Failed],
  execute: ({ selected, resetForm }) =>
    Effect.gen(function* () {
      const service = yield* DashboardService
      const listing = yield* service.request({ path: '/api/music/playlists' })

      const tracks = selected
        ? yield* service.request({ path: `${pathFor(selected)}/tracks` })
        : null

      return Message.Loaded({
        listing: listing.playlists ?? [],
        tracks: tracks?.playlistTracks ?? [],
        resetForm,
      })
    }).pipe(Effect.catch((error) => Effect.succeed(Message.Failed({ message: error.message })))),
})

const Action = Schema.Literals(['save', 'delete', 'import', 'add', 'remove', 'reorder', 'sync'])

const Write = Command.define('Playlists.Write', {
  args: {
    action: Action,
    selected: Schema.NullOr(Schema.String),
    form: Form,
    url: Schema.String,
    trackId: Schema.String,
    trackIds: Schema.Array(Schema.String),
  },
  messages: [Message.Saved, Message.Failed],
  execute: ({ action, selected, form, url, trackId, trackIds }) =>
    Effect.gen(function* () {
      const service = yield* DashboardService
      const path = selected ? pathFor(selected) : '/api/music/playlists'
      let request: DashboardRequest

      if (action === 'save') {
        const values = {
          title: form.title.trim(),
          slug: form.slug.trim(),
          description: form.description.trim(),
          coverImageUrl: form.coverImageUrl.trim(),
          curatorId: form.curatorId.trim() || undefined,
          publishedAt: form.publishedAt.trim() || undefined,
        }

        const payload = selected
          ? yield* Schema.decodeUnknownEffect(UpdatePlaylistInput)(values)
          : yield* Schema.decodeUnknownEffect(CreatePlaylistInput)(values)

        request = { path, method: selected ? 'PATCH' : 'POST', body: JSON.stringify(payload) }
      } else if (action === 'import' || action === 'add') {
        const resource = action === 'import' ? 'playlist' : 'track'

        const parsed = yield* Effect.try({
          try: () => new URL(url.trim()),
          catch: () => new DashboardRequestError({ status: null, message: 'Enter a Spotify URL.' }),
        })

        if (
          parsed.protocol !== 'https:' ||
          parsed.hostname !== 'open.spotify.com' ||
          !new RegExp(`^/(?:intl-[^/]+/)?${resource}/[A-Za-z0-9]+/?$`).test(parsed.pathname)
        )
          return Message.Failed({ message: `Enter an https://open.spotify.com/${resource}/… URL.` })
        request = {
          path:
            action === 'import' ? '/api/music/playlists/import/spotify' : `${path}/tracks/spotify`,
          method: 'POST',
          body: JSON.stringify({ url: parsed.href }),
        }
      } else if (action === 'reorder')
        request = {
          path: `${path}/tracks/order`,
          method: 'PUT',
          body: JSON.stringify({ trackIds }),
        }
      else if (action === 'remove')
        request = { path: `${path}/tracks/${encodeURIComponent(trackId)}`, method: 'DELETE' }
      else if (action === 'sync') request = { path: `${path}/sync-links`, method: 'POST' }
      else request = { path, method: 'DELETE' }

      const result = yield* service.request(request)
      const imported = result.playlistImport

      const notice = imported
        ? `Imported ${imported.trackCount} tracks (${imported.createdTrackCount} new, ${imported.reusedTrackCount} reused). ${imported.enrichmentStatus === 'Accepted' ? 'Link enrichment queued.' : 'Link enrichment unavailable; tracks were imported.'}`
        : action === 'sync'
          ? 'Link sync accepted for background processing.'
          : action === 'delete'
            ? 'Playlist deleted.'
            : 'Playlist changes saved.'

      return Message.Saved({
        selected: imported?.playlistId ?? (action === 'delete' ? null : selected),
        notice,
        resetForm: action === 'save' || action === 'import' || action === 'delete',
      })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.Failed({
            message:
              'Playlist action failed. Check the fields, provider availability and your access, then retry.',
          }),
        ),
      ),
    ),
})

const write = (
  model: Model,
  action: typeof Action.Type,
  trackId = '',
  trackIds: ReadonlyArray<string> = [],
): Result => {
  if (model.busy || (!model.selected && action !== 'save' && action !== 'import')) return { model }

  return {
    model: { ...model, busy: true, error: null, notice: '' },
    commands: [
      Write({
        action,
        selected: model.selected,
        form: model.form,
        url: action === 'import' ? model.importUrl : model.trackUrl,
        trackId,
        trackIds,
      }),
    ],
  }
}

export const update = (model: Model, message: Message): Result =>
  Message.match<Result>(message, {
    FieldChanged: ({ field, value }) =>
      model.busy ? { model } : { model: { ...model, form: { ...model.form, [field]: value } } },
    ImportUrlChanged: ({ value }) =>
      model.busy ? { model } : { model: { ...model, importUrl: value } },
    TrackUrlChanged: ({ value }) =>
      model.busy ? { model } : { model: { ...model, trackUrl: value } },
    New: () => (model.busy ? { model } : { model: { ...initialModel, listing: model.listing } }),
    Select: ({ id }) => {
      const playlist = model.listing.find((item) => item.id === id)

      if (model.busy || !playlist) return { model }

      return {
        model: {
          ...model,
          selected: id,
          form: formFor(playlist),
          tracks: [],
          busy: true,
          error: null,
          notice: '',
          deleting: false,
        },
        commands: [Load({ selected: id, resetForm: true })],
      }
    },
    Save: () => write(model, 'save'),
    Import: () => write(model, 'import'),
    AddTrack: () => write(model, 'add'),
    Sync: () => write(model, 'sync'),
    RemoveTrack: ({ id }) =>
      model.tracks.some((row) => row.track.id === id) ? write(model, 'remove', id) : { model },
    MoveTrack: ({ id, direction }) => {
      const ids = model.tracks.map((row) => row.track.id)
      const index = ids.indexOf(id)
      const target = index + (direction === 'up' ? -1 : 1)

      if (index < 0 || target < 0 || target >= ids.length) return { model }
      ids.splice(index, 1)
      ids.splice(target, 0, id)

      return write(model, 'reorder', '', ids)
    },
    AskDelete: () =>
      model.busy || !model.selected ? { model } : { model: { ...model, deleting: true } },
    CancelDelete: () => (model.busy ? { model } : { model: { ...model, deleting: false } }),
    ConfirmDelete: () => (model.deleting ? write(model, 'delete') : { model }),
    Refresh: () =>
      model.busy
        ? { model }
        : {
            model: { ...model, busy: true, error: null },
            commands: [Load({ selected: model.selected, resetForm: false })],
          },
    Loaded: ({ listing, tracks, resetForm }) => {
      const playlist = listing.find((item) => item.id === model.selected)

      const form = resetForm ? (playlist ? formFor(playlist) : emptyForm) : model.form

      return { model: { ...model, listing, tracks, form, busy: false, error: null } }
    },
    Saved: ({ selected, notice, resetForm }) => ({
      model: {
        ...model,
        selected,
        notice,
        deleting: false,
        trackUrl: '',
        importUrl: '',
        busy: true,
      },
      commands: [Load({ selected, resetForm })],
    }),
    Failed: ({ message }) => ({ model: { ...model, busy: false, error: message } }),
  })

const labels = {
  title: 'Playlist title',
  slug: 'Playlist slug',
  description: 'Description',
  coverImageUrl: 'Cover image URL',
  curatorId: 'Curator ID',
  publishedAt: 'Published at',
}

export const view = defineView<Model, Message>((model, h) =>
  h.section(
    [h.Class('dashboard-form')],
    [
      model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
      model.notice ? h.p([h.Role('status')], [model.notice]) : h.empty,
      h.form(
        [h.Class('dashboard-panel dashboard-form'), h.OnSubmit(Message.Import())],
        [
          h.h2([], ['Import from Spotify']),
          h.label(
            [],
            [
              'Spotify playlist URL',
              h.input([
                h.Type('url'),
                h.Required(true),
                h.Value(model.importUrl),
                h.Disabled(model.busy),
                h.OnInput((value) => Message.ImportUrlChanged({ value })),
              ]),
            ],
          ),
          h.button([h.Type('submit'), h.Disabled(model.busy)], ['Import playlist']),
        ],
      ),
      h.div(
        [h.Class('creator-actions')],
        [
          h.button([h.Disabled(model.busy), h.OnClick(Message.New())], ['New playlist']),
          h.button([h.Disabled(model.busy), h.OnClick(Message.Refresh())], ['Refresh playlists']),
        ],
      ),
      h.ul(
        [h.Class('dashboard-list'), h.AriaLabel('Playlists')],
        model.listing.map((item) =>
          h.li(
            [h.Key(item.id)],
            [
              h.div([], [h.strong([], [item.title]), h.small([], [item.slug])]),
              h.button(
                [
                  h.Disabled(model.busy),
                  h.AriaPressed(String(item.id === model.selected)),
                  h.OnClick(Message.Select({ id: item.id })),
                ],
                ['Edit'],
              ),
            ],
          ),
        ),
      ),
      h.form(
        [h.Class('dashboard-panel dashboard-form'), h.OnSubmit(Message.Save())],
        [
          h.h2([], [model.selected ? 'Edit playlist' : 'Create playlist']),
          ...fields.map((field) =>
            h.label(
              [],
              [
                labels[field],
                field === 'description'
                  ? h.textarea([
                      h.Value(model.form[field]),
                      h.Disabled(model.busy),
                      h.Rows(3),
                      h.OnInput((value) => Message.FieldChanged({ field, value })),
                    ])
                  : h.input([
                      h.Value(model.form[field]),
                      h.Disabled(model.busy),
                      h.Required(field === 'title' || field === 'slug'),
                      h.OnInput((value) => Message.FieldChanged({ field, value })),
                    ]),
              ],
            ),
          ),
          h.button(
            [h.Type('submit'), h.Disabled(model.busy)],
            [model.selected ? 'Save playlist' : 'Create playlist'],
          ),
        ],
      ),
      model.selected
        ? h.section(
            [h.Class('dashboard-panel dashboard-form')],
            [
              h.h2([], ['Playlist tracks']),
              h.form(
                [h.OnSubmit(Message.AddTrack()), h.Class('dashboard-form')],
                [
                  h.label(
                    [],
                    [
                      'Spotify track URL',
                      h.input([
                        h.Type('url'),
                        h.Required(true),
                        h.Value(model.trackUrl),
                        h.Disabled(model.busy),
                        h.OnInput((value) => Message.TrackUrlChanged({ value })),
                      ]),
                    ],
                  ),
                  h.button([h.Type('submit'), h.Disabled(model.busy)], ['Add Spotify track']),
                ],
              ),
              model.tracks.length === 0 ? h.p([], ['No tracks yet.']) : h.empty,
              h.ol(
                [h.Class('dashboard-list session-list'), h.AriaLabel('Playlist tracks')],
                model.tracks.map((row, index) =>
                  h.li(
                    [h.Key(row.track.id)],
                    [
                      h.div(
                        [],
                        [
                          h.strong([], [`${index + 1}. ${row.track.title}`]),
                          h.small([], [row.track.artistNames?.join(', ') ?? '']),
                        ],
                      ),
                      h.div(
                        [h.Class('creator-actions')],
                        [
                          h.button(
                            [
                              h.Disabled(model.busy || index === 0),
                              h.AriaLabel(`Move ${row.track.title} up`),
                              h.OnClick(Message.MoveTrack({ id: row.track.id, direction: 'up' })),
                            ],
                            ['↑'],
                          ),
                          h.button(
                            [
                              h.Disabled(model.busy || index === model.tracks.length - 1),
                              h.AriaLabel(`Move ${row.track.title} down`),
                              h.OnClick(Message.MoveTrack({ id: row.track.id, direction: 'down' })),
                            ],
                            ['↓'],
                          ),
                          h.button(
                            [
                              h.Disabled(model.busy),
                              h.AriaLabel(`Remove ${row.track.title}`),
                              h.OnClick(Message.RemoveTrack({ id: row.track.id })),
                            ],
                            ['Remove'],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              h.button([h.Disabled(model.busy), h.OnClick(Message.Sync())], ['Sync track links']),
              h.button(
                [h.Disabled(model.busy), h.OnClick(Message.AskDelete())],
                ['Delete playlist'],
              ),
              model.deleting
                ? h.div(
                    [h.Role('alert')],
                    [
                      h.p(
                        [],
                        ['Permanently delete this playlist? Tracks remain in the music catalog.'],
                      ),
                      h.button(
                        [h.Disabled(model.busy), h.OnClick(Message.ConfirmDelete())],
                        ['Confirm delete playlist'],
                      ),
                      h.button(
                        [h.Disabled(model.busy), h.OnClick(Message.CancelDelete())],
                        ['Keep playlist'],
                      ),
                    ],
                  )
                : h.empty,
            ],
          )
        : h.empty,
    ],
  ),
)
