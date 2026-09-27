import { ROLES } from '@gbfm/core/roles'
import { PlayerPreferences } from '@gbfm/player'
import { Effect, Match, Schema } from 'effect'
import { Command, type Runtime, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'

import { SpotifyConnection, SpotifyStatus, disconnected } from '../spotify'
import { readTheme, saveTheme, Theme } from '../theme'
import { DashboardDocument, Row } from './document'
import { DashboardService } from './service'
import * as Sessions from './sessions'
import * as Shows from './shows'

export const Role = Schema.NullOr(Schema.Literals(ROLES))

export type Role = typeof Role.Type

export const Principal = Schema.Struct({ id: Schema.String, role: Role })

export type Principal = typeof Principal.Type

export const Model = Schema.Struct({
  section: Schema.String,
  principal: Principal,
  phase: Schema.Literals(['loading', 'ready', 'saving', 'error']),
  rows: Schema.Array(Row),
  fields: Schema.Record(Schema.String, Schema.String),
  toggles: Schema.Record(Schema.String, Schema.Boolean),
  error: Schema.NullOr(Schema.String),
  spotify: SpotifyStatus,
  telemetry: DashboardDocument.fields.telemetry,
  users: DashboardDocument.fields.users,
  sessions: Sessions.Model,
  shows: Shows.Model,
})

export type Model = typeof Model.Type

const adminSections = new Set([
  'admin',
  'users',
  'sessions',
  'shows',
  'music',
  'playlists',
  'search',
  'newsletter',
  'email-logs',
  'frontend-errors',
  'all/mixes',
  'all/tweets',
  'all/editorial',
])

export const isAdminSection = (section: string) => adminSections.has(section)

export const endpointFor = (section: string, query = new URLSearchParams()) => {
  if (section === 'users') {
    const offset = Number(query.get('offset') ?? '0')

    const params = new URLSearchParams({
      limit: '25',
      offset: String(Number.isSafeInteger(offset) && offset >= 0 ? offset : 0),
    })

    const search = query.get('search')?.trim()

    if (search) {
      params.set('searchField', 'email')
      params.set('searchValue', search)
    }

    return `/auth/admin/list-users?${params}`
  }

  const endpoints = new Map(
    Object.entries({
      overview: '/api/favorites?limit=25&offset=0',
      admin: '/api/admin/overview',
      profile: '/api/user/profile',
      email: '/api/user/email-preferences',
      favorites: '/api/favorites?limit=25&offset=0',
      reminders: '/api/music-reminders',
      'content/mixes': '/api/content/audio/mix/manage?limit=25&offset=0',
      'content/tweets': '/api/content/posts/manage?type=micro&limit=25&offset=0',
      'content/editorial': '/api/content/posts/manage?type=post&limit=25&offset=0',
      'all/mixes': '/api/content/audio/mix/manage?limit=25&offset=0',
      'all/tweets': '/api/content/posts/manage?type=micro&limit=25&offset=0',
      'all/editorial': '/api/content/posts/manage?type=post&limit=25&offset=0',
      shows: '/api/shows/manage?limit=25&offset=0',
      music: '/api/music/artists',
      playlists: '/api/music/playlists',
      newsletter: '/api/admin/newsletter-subscribers',
      'email-logs': '/api/email/logs?limit=50&offset=0',
      'frontend-errors': '/api/admin/telemetry',
      search: '/api/search?q=',
    }),
  )

  return endpoints.get(section) ?? null
}

export const Message = defineMessageUnion({
  GotSessionMessage: { message: Sessions.Message },
  GotShowMessage: { message: Shows.Message },
  LoadRequested: {},
  Loaded: { document: DashboardDocument },
  Failed: { message: Schema.String },
  FieldChanged: { name: Schema.String, value: Schema.String },
  ToggleChanged: { name: Schema.String, value: Schema.Boolean },
  SaveProfile: {},
  SaveEmailPreferences: {},
  SavePlayerPreferences: {},
  PlayerPreferencesLoaded: { preferences: PlayerPreferences },
  ThemeSelected: { theme: Theme },
  ThemeRestored: { theme: Theme },
  SearchRequested: {},
  DeleteRequested: { id: Schema.String },
  Saved: {},
  SpotifyRequested: {
    action: Schema.Literals(['status', 'connect', 'disconnect', 'completeCallback']),
  },
  SpotifyLoaded: { status: SpotifyStatus },
})

export type Message = typeof Message.Type

type Services = DashboardService | SpotifyConnection | Sessions.SessionService

const SpotifyRequest = Command.define('Spotify.Connection', {
  args: { action: Schema.Literals(['status', 'connect', 'disconnect', 'completeCallback']) },
  messages: [Message.SpotifyLoaded, Message.Failed],
  execute: ({ action }) =>
    SpotifyConnection.pipe(
      Effect.flatMap((service) => service[action]),
      Effect.map((status) => Message.SpotifyLoaded({ status: status ?? disconnected })),
      Effect.catch((error) => Effect.succeed(Message.Failed({ message: error.message }))),
    ),
})

const RestoreTheme = Command.define('Appearance.Restore', {
  messages: [Message.ThemeRestored],
  execute: Effect.sync(() => Message.ThemeRestored({ theme: readTheme() })),
})

const RestorePlayerPreferences = Command.define('PlayerPreferences.Restore', {
  messages: [Message.PlayerPreferencesLoaded],
  execute: DashboardService.pipe(
    Effect.flatMap((service) => service.readPlayerPreferences),
    Effect.map((preferences) => Message.PlayerPreferencesLoaded({ preferences })),
  ),
})

const SavePlayerPreferences = Command.define('PlayerPreferences.Save', {
  args: { preferences: PlayerPreferences },
  messages: [Message.Saved, Message.Failed],
  execute: ({ preferences }) =>
    DashboardService.pipe(
      Effect.flatMap((service) => service.writePlayerPreferences(preferences)),
      Effect.as(Message.Saved()),
      Effect.catch((error) => Effect.succeed(Message.Failed({ message: error.message }))),
    ),
})

const ApplyTheme = Command.define('Appearance.Apply', {
  args: { theme: Theme },
  messages: [Message.ThemeRestored],
  execute: ({ theme }) =>
    Effect.sync(() => {
      saveTheme(theme)

      return Message.ThemeRestored({ theme })
    }),
})

const Load = Command.define('DashboardLoad', {
  args: { path: Schema.String },
  messages: [Message.Loaded, Message.Failed],
  execute: ({ path }) =>
    DashboardService.pipe(
      Effect.flatMap((service) => service.request({ path })),
      Effect.map((document) => Message.Loaded({ document })),
      Effect.catch((error) => Effect.succeed(Message.Failed({ message: error.message }))),
    ),
})

// Dashboard command arguments can contain account data. Parent telemetry must mark command spans private.
const Write = Command.define('DashboardWrite', {
  args: {
    path: Schema.String,
    method: Schema.Literals(['PATCH', 'PUT', 'DELETE']),
    body: Schema.String,
  },
  messages: [Message.Saved, Message.Failed],
  execute: ({ path, method, body }) =>
    DashboardService.pipe(
      Effect.flatMap((service) => service.request({ path, method, body })),
      Effect.as(Message.Saved()),
      Effect.catch((error) => Effect.succeed(Message.Failed({ message: error.message }))),
    ),
})

export const initialModel = (section: string, principal: Principal): Model => ({
  section,
  principal,
  phase: 'loading',
  rows: [],
  fields: {},
  toggles: {},
  error: null,
  spotify: disconnected,
  sessions: Sessions.initialModel,
  shows: Shows.initialModel,
})

export const init =
  (
    section: string,
    principal: Principal,
  ): Runtime.ApplicationInit<Model, Message, void, Services> =>
  () => {
    const model = initialModel(section, principal)
    const endpoint = endpointFor(section)

    if (isAdminSection(section) && principal.role !== 'admin')
      return { model: { ...model, phase: 'error', error: 'Administrator access required.' } }

    if (section === 'appearance')
      return { model: { ...model, phase: 'ready' }, commands: [RestoreTheme()] }

    if (section === 'player') return { model, commands: [RestorePlayerPreferences()] }

    if (section === 'integrations' || section === 'spotify-callback')
      return {
        model,
        commands: [
          SpotifyRequest({ action: section === 'integrations' ? 'status' : 'completeCallback' }),
        ],
      }

    return endpoint
      ? { model, commands: [Load({ path: endpoint })] }
      : { model: { ...model, phase: 'ready' } }
  }

export const update = (model: Model, message: Message): Update.Return<Model, Message, Services> =>
  Message.match<Update.Return<Model, Message, Services>>(message, {
    GotShowMessage: ({ message }) => {
      if (model.principal.role !== 'admin' || model.section !== 'shows') return { model }
      const child = Shows.update(model.shows, message)

      return {
        model: { ...model, shows: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotShowMessage({ message }),
        ),
      }
    },
    GotSessionMessage: ({ message }) => {
      if (model.principal.role !== 'admin' || model.section !== 'sessions') return { model }
      const child = Sessions.update(model.sessions, message)

      return {
        model: { ...model, sessions: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotSessionMessage({ message }),
        ),
      }
    },
    SpotifyRequested: ({ action }) => ({
      model: { ...model, phase: 'loading', error: null },
      commands: [SpotifyRequest({ action })],
    }),
    SpotifyLoaded: ({ status }) => ({
      model: { ...model, phase: 'ready', spotify: status, error: null },
    }),
    ThemeSelected: ({ theme }) => ({ model, commands: [ApplyTheme({ theme })] }),
    ThemeRestored: ({ theme }) => ({ model: { ...model, fields: { ...model.fields, theme } } }),
    PlayerPreferencesLoaded: ({ preferences }) => ({
      model: { ...model, phase: 'ready', toggles: preferences },
    }),
    LoadRequested: () => {
      if (model.section === 'integrations')
        return {
          model: { ...model, phase: 'loading', error: null },
          commands: [SpotifyRequest({ action: 'status' })],
        }
      const path = endpointFor(model.section)

      return path
        ? { model: { ...model, phase: 'loading', error: null }, commands: [Load({ path })] }
        : { model }
    },
    Loaded: ({ document }) => ({
      model: {
        ...model,
        phase: 'ready',
        rows: document.rows,
        fields: document.fields,
        toggles: document.toggles,
        telemetry: document.telemetry,
        users: document.users,
        shows: { ...Shows.initialModel, listing: document.shows },
        error: null,
      },
    }),
    Failed: ({ message: error }) => ({ model: { ...model, phase: 'error', error } }),
    FieldChanged: ({ name, value }) => ({
      model: { ...model, fields: { ...model.fields, [name]: value } },
    }),
    ToggleChanged: ({ name, value }) => ({
      model: { ...model, toggles: { ...model.toggles, [name]: value } },
    }),
    SaveProfile: () => ({
      model: { ...model, phase: 'saving' },
      commands: [
        Write({ path: '/api/user/profile', method: 'PATCH', body: JSON.stringify(model.fields) }),
      ],
    }),
    SaveEmailPreferences: () => ({
      model: { ...model, phase: 'saving' },
      commands: [
        Write({
          path: '/api/user/email-preferences',
          method: 'PATCH',
          body: JSON.stringify(model.toggles),
        }),
      ],
    }),
    SavePlayerPreferences: () => ({
      model: { ...model, phase: 'saving' },
      commands: [
        SavePlayerPreferences({
          preferences: {
            continueQueue: model.toggles.continueQueue ?? true,
            restorePosition: model.toggles.restorePosition ?? true,
          },
        }),
      ],
    }),
    SearchRequested: () => ({
      model: { ...model, phase: 'loading' },
      commands: [Load({ path: `/api/search?q=${encodeURIComponent(model.fields.query ?? '')}` })],
    }),
    DeleteRequested: ({ id }) => {
      const row = model.rows.find((item) => item.id === id)
      const actionId = row?.actionId

      if (!actionId) return { model }

      const path = Match.value(model.section).pipe(
        Match.when('reminders', () => `/api/music-reminders/${encodeURIComponent(actionId)}`),
        Match.when(
          'favorites',
          () => `/api/favorites/${actionId.split('/').map(encodeURIComponent).join('/')}`,
        ),
        Match.orElse(() => null),
      )

      return path
        ? {
            model: { ...model, phase: 'saving' },
            commands: [Write({ path, method: 'DELETE', body: '' })],
          }
        : { model }
    },
    Saved: () => {
      const path = endpointFor(model.section)

      return path
        ? { model: { ...model, phase: 'loading', error: null }, commands: [Load({ path })] }
        : { model: { ...model, phase: 'ready' } }
    },
  })
