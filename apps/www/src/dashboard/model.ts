import { AddEntityLinkInput, CreateLabelInput } from '@gbfm/api/music'
import { ROLES } from '@gbfm/core/roles'
import { PlayerPreferences } from '@gbfm/player'
import { Effect, Match, Schema } from 'effect'
import { Command, type Runtime, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'

import { readTheme, saveTheme, Theme } from '../application/theme'
import { SpotifyConnection, SpotifyStatus, disconnected } from '../spotify/connection'
import { catalogPayload, entityRoute, Kind, tabs } from './catalog'
import { DashboardDocument, Row } from './document'
import * as Playlists from './playlists'
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
  playlists: Playlists.Model,
  catalogRevision: Schema.Number,
  catalogNotice: Schema.String,
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

export const isAdminSection = (section: string) =>
  adminSections.has(section) || section.startsWith('music-entity/')

export const endpointFor = (section: string, query = new URLSearchParams()) => {
  const entity = entityRoute(section)

  if (entity) return entity.path

  if (section === 'music') {
    const tab = tabs.find((tab) => tab === query.get('tab')) ?? 'artists'

    return `/api/music/${tab}${tab === 'labels' ? '/manage' : ''}`
  }

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

const CatalogOperation = Schema.Literals([
  'save',
  'delete',
  'add-link',
  'remove-link',
  'create-label',
])

export const Message = defineMessageUnion({
  SaveCatalogEntity: {},
  DeleteCatalogEntity: {},
  AddCatalogLink: {},
  DeleteCatalogLink: { id: Schema.String },
  CreateLabel: {},
  CatalogCompleted: { operation: CatalogOperation },
  CatalogLinksLoaded: { rows: Schema.Array(Row), revision: Schema.Number },
  CatalogLinksFailed: { revision: Schema.Number },
  GotSessionMessage: { message: Sessions.Message },
  GotShowMessage: { message: Shows.Message },
  GotPlaylistMessage: { message: Playlists.Message },
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

const LoadCatalogLinks = Command.define('Catalog.LoadLinks', {
  args: { kind: Kind, id: Schema.String, revision: Schema.Number },
  messages: [Message.CatalogLinksLoaded, Message.CatalogLinksFailed],
  execute: ({ kind, id, revision }) =>
    DashboardService.pipe(
      Effect.flatMap((service) =>
        service.request({ path: `/api/music/${kind}/${encodeURIComponent(id)}/links` }),
      ),
      Effect.map((document) => Message.CatalogLinksLoaded({ rows: document.rows, revision })),
      Effect.catch(() => Effect.succeed(Message.CatalogLinksFailed({ revision }))),
    ),
})

const WriteCatalog = Command.define('Catalog.Write', {
  args: {
    operation: CatalogOperation,
    kind: Kind,
    id: Schema.String,
    fields: Schema.Record(Schema.String, Schema.String),
    linkId: Schema.String,
  },
  messages: [Message.CatalogCompleted, Message.Failed],
  execute: ({ operation, kind, id, fields, linkId }) =>
    Effect.gen(function* () {
      const service = yield* DashboardService
      const path = `/api/music/${kind}s/${encodeURIComponent(id)}`
      const links = `/api/music/${kind}/${encodeURIComponent(id)}/links`

      if (operation === 'save') {
        const body = yield* catalogPayload(kind, fields)
        yield* service.request({ path, method: 'PATCH', body })
      } else if (operation === 'delete') yield* service.request({ path, method: 'DELETE' })
      else if (operation === 'remove-link')
        yield* service.request({ path: `${links}/${encodeURIComponent(linkId)}`, method: 'DELETE' })
      else if (operation === 'add-link') {
        const payload = yield* Schema.decodeUnknownEffect(AddEntityLinkInput)({
          platform: fields.platform || 'spotify',
          url: fields.linkUrl,
          status: 'verified',
        })

        yield* service.request({ path: links, method: 'POST', body: JSON.stringify(payload) })
      } else {
        const payload = yield* Schema.decodeUnknownEffect(CreateLabelInput)({
          name: fields.name?.trim(),
          slug: fields.slug?.trim(),
          content: '',
        })

        yield* service.request({
          path: '/api/music/labels',
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }

      return Message.CatalogCompleted({ operation })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.Failed({
            message: 'Catalog action failed. Check the fields and your access, then retry.',
          }),
        ),
      ),
    ),
})

const writeCatalog = (
  model: Model,
  operation: typeof CatalogOperation.Type,
  linkId = '',
): Update.Return<Model, Message, Services> => {
  const entity = entityRoute(model.section)

  if (
    model.principal.role !== 'admin' ||
    model.phase === 'saving' ||
    (entity && model.fields.id !== entity.id) ||
    (!entity && operation !== 'create-label')
  )
    return { model }

  return {
    model: {
      ...model,
      phase: 'saving',
      error: null,
      catalogRevision: model.catalogRevision + 1,
      catalogNotice: '',
    },
    commands: [
      WriteCatalog({
        operation,
        kind: entity?.kind ?? 'label',
        id: entity?.id ?? '',
        fields: model.fields,
        linkId,
      }),
    ],
  }
}

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
  playlists: Playlists.initialModel,
  catalogRevision: 0,
  catalogNotice: '',
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
    GotPlaylistMessage: ({ message }) => {
      if (model.principal.role !== 'admin' || model.section !== 'playlists') return { model }
      const child = Playlists.update(model.playlists, message)

      return {
        model: { ...model, playlists: child.model },
        commands: Command.mapMessages(child.commands ?? [], (message) =>
          Message.GotPlaylistMessage({ message }),
        ),
      }
    },
    SaveCatalogEntity: () => writeCatalog(model, 'save'),
    DeleteCatalogEntity: () => writeCatalog(model, 'delete'),
    AddCatalogLink: () => writeCatalog(model, 'add-link'),
    DeleteCatalogLink: ({ id }) =>
      model.rows.some((row) => row.id === id) ? writeCatalog(model, 'remove-link', id) : { model },
    CreateLabel: () =>
      model.section === 'music' ? writeCatalog(model, 'create-label') : { model },
    CatalogLinksLoaded: ({ rows, revision }) =>
      revision !== model.catalogRevision
        ? { model }
        : {
            model: { ...model, rows, fields: { ...model.fields, linksError: '' } },
          },
    CatalogLinksFailed: ({ revision }) =>
      revision !== model.catalogRevision
        ? { model }
        : {
            model: {
              ...model,
              fields: { ...model.fields, linksError: 'Source links are unavailable.' },
            },
          },
    CatalogCompleted: ({ operation }) => {
      if (operation === 'delete')
        return { model: { ...model, phase: 'ready', fields: { deleted: 'true' }, rows: [] } }

      if (operation === 'create-label')
        return {
          model: { ...model, phase: 'loading' },
          commands: [Load({ path: '/api/music/labels/manage' })],
        }
      const entity = entityRoute(model.section)

      if (!entity) return { model }

      return operation === 'save'
        ? {
            model: { ...model, phase: 'loading', catalogNotice: 'Entity saved.' },
            commands: [Load({ path: entity.path })],
          }
        : {
            model: { ...model, phase: 'ready', fields: { ...model.fields, linkUrl: '' } },
            commands: [
              LoadCatalogLinks({
                kind: entity.kind,
                id: entity.id,
                revision: model.catalogRevision,
              }),
            ],
          }
    },
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
    Loaded: ({ document }) => {
      const entity = entityRoute(model.section)

      return {
        model: {
          ...model,
          phase: 'ready',
          rows: document.rows,
          fields: document.fields,
          toggles: document.toggles,
          telemetry: document.telemetry,
          users: document.users,
          shows: { ...Shows.initialModel, listing: document.shows },
          playlists: { ...Playlists.initialModel, listing: document.playlists ?? [] },
          error: null,
          catalogRevision: model.catalogRevision + 1,
        },
        commands: entity
          ? [
              LoadCatalogLinks({
                kind: entity.kind,
                id: entity.id,
                revision: model.catalogRevision + 1,
              }),
            ]
          : [],
      }
    },
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
