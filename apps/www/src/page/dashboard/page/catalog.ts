import {
  AlbumListResponse,
  AlbumResponse,
  ArtistListResponse,
  ArtistResponse,
  EntityLinkListResponse,
  LabelListResponse,
  LabelResponse,
  PlaylistListResponse,
  TrackListResponse,
  TrackResponse,
  UpdateAlbumInput,
  UpdateArtistInput,
  UpdateLabelInput,
  UpdateTrackInput,
} from '@gbfm/api/music'
import { Effect, Match, Schema } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'

import { type DashboardDocument, emptyDocument } from '../document'
import type { Message as DashboardMessage } from '../message'
import type { Model } from '../model'

export const Kind = Schema.Literals(['artist', 'album', 'track', 'label'])

export type Kind = typeof Kind.Type

export const tabs = ['artists', 'albums', 'tracks', 'playlists', 'labels'] as const

export const entityRoute = (section: string) => {
  const match = /^music-entity\/(artist|album|track|label)\/([^/]+)$/.exec(section)

  if (!match) return null
  const kind = Schema.decodeUnknownSync(Kind)(match[1])
  const id = match[2]

  if (!id) return null

  return { kind, id, path: `/api/music/${kind}s/${encodeURIComponent(id)}` }
}

export const fieldsFor = (kind: Kind) =>
  Match.value(kind).pipe(
    Match.when('artist', () => ['name', 'slug', 'bio', 'imageUrl', 'genres', 'publishedAt']),
    Match.when('album', () => [
      'title',
      'slug',
      'artistNames',
      'releaseDate',
      'coverImageUrl',
      'genres',
      'albumType',
      'publishedAt',
    ]),
    Match.when('track', () => [
      'title',
      'slug',
      'artistNames',
      'coverImageUrl',
      'albumId',
      'trackNumber',
      'publishedAt',
    ]),
    Match.when('label', () => [
      'name',
      'slug',
      'description',
      'imageUrl',
      'bannerImageUrl',
      'content',
      'tags',
      'genres',
      'publishedAt',
    ]),
    Match.exhaustive,
  )

export const catalogPayload = (kind: Kind, fields: Readonly<Record<string, string>>) =>
  Effect.gen(function* () {
    const trackNumber =
      kind === 'track' && fields.trackNumber?.trim()
        ? yield* Schema.decodeUnknownEffect(
            Schema.NumberFromString.pipe(Schema.check(Schema.isFinite())),
          )(fields.trackNumber.trim())
        : null

    const payload = Object.fromEntries(
      fieldsFor(kind).map((key) => {
        const value = fields[key]?.trim() ?? ''

        if (['genres', 'artistNames', 'tags'].includes(key))
          return [
            key,
            value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          ]

        if (key === 'trackNumber') return [key, trackNumber]

        return [key, kind === 'artist' ? value : value || null]
      }),
    )

    return yield* Match.value(kind).pipe(
      Match.when('artist', () =>
        Schema.decodeUnknownEffect(UpdateArtistInput)(payload).pipe(Effect.map(JSON.stringify)),
      ),
      Match.when('album', () =>
        Schema.decodeUnknownEffect(UpdateAlbumInput)(payload).pipe(Effect.map(JSON.stringify)),
      ),
      Match.when('track', () =>
        Schema.decodeUnknownEffect(UpdateTrackInput)(payload).pipe(Effect.map(JSON.stringify)),
      ),
      Match.when('label', () =>
        Schema.decodeUnknownEffect(UpdateLabelInput)(payload).pipe(Effect.map(JSON.stringify)),
      ),
      Match.exhaustive,
    )
  })

/** The API schema establishes the entity type before projecting editable fields. */
export const parseCatalogDocument = (
  path: string,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Music HTTP response parsing boundary.
  input: unknown,
): Effect.Effect<DashboardDocument, Schema.SchemaError> | undefined => {
  if (/^\/api\/music\/(artist|album|track|label)\/[^/]+\/links$/.test(path))
    return Schema.decodeUnknownEffect(EntityLinkListResponse)(input).pipe(
      Effect.map((links) => ({
        ...emptyDocument,
        rows: links.map((link) => ({
          id: link.id,
          title: link.platform,
          detail: `${link.status} · ${link.url}`,
          href: /^https?:\/\//.test(link.url) ? link.url : null,
          actionId: link.id,
        })),
      })),
    )

  const entity = /^\/api\/music\/(artists|albums|tracks|labels)\/[^/]+$/.exec(path)

  if (entity && !path.endsWith('/manage')) {
    const project = (
      values: Readonly<Record<string, string | number | null | ReadonlyArray<string>>>,
    ): DashboardDocument => ({
      ...emptyDocument,
      fields: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.join(', ') : value === null ? '' : String(value),
        ]),
      ),
    })

    switch (entity[1]) {
      case 'artists':
        return Schema.decodeUnknownEffect(ArtistResponse)(input).pipe(
          Effect.map((item) =>
            project({
              id: item.id,
              name: item.name,
              slug: item.slug,
              bio: item.bio,
              imageUrl: item.imageUrl,
              genres: item.genres,
              publishedAt: item.publishedAt,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            }),
          ),
        )
      case 'albums':
        return Schema.decodeUnknownEffect(AlbumResponse)(input).pipe(
          Effect.map((item) =>
            project({
              id: item.id,
              title: item.title,
              slug: item.slug,
              artistNames: item.artistNames,
              releaseDate: item.releaseDate,
              coverImageUrl: item.coverImageUrl,
              genres: item.genres,
              albumType: item.albumType,
              publishedAt: item.publishedAt,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            }),
          ),
        )
      case 'tracks':
        return Schema.decodeUnknownEffect(TrackResponse)(input).pipe(
          Effect.map((item) =>
            project({
              id: item.id,
              title: item.title,
              slug: item.slug,
              artistNames: item.artistNames,
              coverImageUrl: item.coverImageUrl,
              albumId: item.albumId,
              trackNumber: item.trackNumber,
              publishedAt: item.publishedAt,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            }),
          ),
        )
      case 'labels':
        return Schema.decodeUnknownEffect(LabelResponse)(input).pipe(
          Effect.map((item) =>
            project({
              id: item.id,
              name: item.name,
              slug: item.slug,
              description: item.description,
              content: item.content,
              imageUrl: item.imageUrl,
              bannerImageUrl: item.bannerImageUrl,
              tags: item.tags,
              genres: item.genres,
              publishedAt: item.publishedAt,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            }),
          ),
        )
    }
  }

  const row = (
    item: { readonly id: string; readonly slug: string; readonly publishedAt: string | null },
    title: string,
    kind: string,
  ) => ({
    id: item.id,
    title,
    detail: `${item.slug} · ${item.publishedAt ? 'Published' : 'Draft'}`,
    href:
      kind === 'playlist'
        ? '/dashboard/playlists'
        : `/dashboard/music-entity/${kind}/${encodeURIComponent(item.id)}`,
    actionId: null,
  })

  switch (path) {
    case '/api/music/artists':
      return Schema.decodeUnknownEffect(ArtistListResponse)(input).pipe(
        Effect.map((items) => ({
          ...emptyDocument,
          fields: { tab: 'artists' },
          rows: items.map((item) => row(item, item.name, 'artist')),
        })),
      )
    case '/api/music/albums':
      return Schema.decodeUnknownEffect(AlbumListResponse)(input).pipe(
        Effect.map((items) => ({
          ...emptyDocument,
          fields: { tab: 'albums' },
          rows: items.map((item) => row(item, item.title, 'album')),
        })),
      )
    case '/api/music/tracks':
      return Schema.decodeUnknownEffect(TrackListResponse)(input).pipe(
        Effect.map((items) => ({
          ...emptyDocument,
          fields: { tab: 'tracks' },
          rows: items.map((item) => row(item, item.title, 'track')),
        })),
      )
    case '/api/music/playlists':
      return Schema.decodeUnknownEffect(PlaylistListResponse)(input).pipe(
        Effect.map((items) => ({
          ...emptyDocument,
          playlists: items,
          fields: { tab: 'playlists' },
          rows: items.map((item) => row(item, item.title, 'playlist')),
        })),
      )
    case '/api/music/labels/manage':
      return Schema.decodeUnknownEffect(LabelListResponse)(input).pipe(
        Effect.map((items) => ({
          ...emptyDocument,
          fields: { tab: 'labels' },
          rows: items.map((item) => row(item, item.name, 'label')),
        })),
      )
    default:
      return undefined
  }
}

export const catalogView = (
  model: Model,
  h: HtmlBuilder<DashboardMessage>,
  Message: typeof DashboardMessage,
) => {
  const entity = entityRoute(model.section)

  const field = (name: string, label: string) =>
    h.label(
      [],
      [
        label,
        ['content', 'bio', 'description'].includes(name)
          ? h.textarea([
              h.Rows(5),
              h.Disabled(model.phase === 'saving'),
              h.Value(model.fields[name] ?? ''),
              h.OnInput((value) => Message.FieldChanged({ name, value })),
            ])
          : h.input([
              h.Disabled(model.phase === 'saving'),
              h.Value(model.fields[name] ?? ''),
              h.OnInput((value) => Message.FieldChanged({ name, value })),
            ]),
      ],
    )

  if (entity && !model.fields.id && !model.fields.deleted)
    return h.section(
      [h.Class('dashboard-panel')],
      [
        h.p([h.Role('alert')], [model.error ?? 'Could not load this catalog entity.']),
        h.button([h.OnClick(Message.LoadRequested())], ['Try again']),
      ],
    )

  if (!entity)
    return h.section(
      [h.Class('dashboard-form')],
      [
        h.nav(
          [h.AriaLabel('Catalog types'), h.Class('user-pagination')],
          tabs.map((tab) =>
            h.a(
              [
                h.Href(`/dashboard/music?tab=${tab}`),
                h.AriaCurrent(model.fields.tab === tab ? 'page' : 'false'),
              ],
              [tab],
            ),
          ),
        ),
        model.fields.tab === 'labels'
          ? h.form(
              [h.Class('dashboard-panel dashboard-form'), h.OnSubmit(Message.CreateLabel())],
              [
                h.h2([], ['New label']),
                field('name', 'Label name'),
                field('slug', 'Label slug'),
                h.button(
                  [h.Type('submit'), h.Disabled(model.phase === 'saving')],
                  ['Create label'],
                ),
              ],
            )
          : h.empty,
        model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
        h.ul(
          [h.Class('dashboard-list session-list')],
          model.rows.map((row) =>
            h.li(
              [h.Key(row.id)],
              [
                h.div([], [h.strong([], [row.title]), h.small([], [row.detail])]),
                h.a([h.Href(row.href ?? '/dashboard/music')], ['Edit']),
              ],
            ),
          ),
        ),
        model.rows.length === 0 ? h.p([], ['No catalog entries found.']) : h.empty,
      ],
    )

  return h.section(
    [h.Class('dashboard-form')],
    [
      h.a([h.Href('/dashboard/music')], ['← Music catalog']),
      model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
      model.catalogNotice && !model.fields.deleted
        ? h.p([h.Role('status')], [model.catalogNotice])
        : h.empty,
      model.fields.deleted
        ? h.p([h.Role('status')], ['Entity deleted.'])
        : h.fieldset(
            [h.Disabled(model.phase === 'saving'), h.Class('contents')],
            [
              h.form(
                [
                  h.Class('dashboard-panel dashboard-form'),
                  h.OnSubmit(Message.SaveCatalogEntity()),
                ],
                [
                  h.h2([], [`Edit ${entity.kind}`]),
                  ...fieldsFor(entity.kind).map((name) => field(name, name)),
                  h.p(
                    [],
                    [
                      `Created ${model.fields.createdAt?.slice(0, 10) ?? ''} · Updated ${model.fields.updatedAt?.slice(0, 10) ?? ''}`,
                    ],
                  ),
                  h.button(
                    [h.Type('submit')],
                    [model.phase === 'saving' ? 'Saving…' : 'Save entity'],
                  ),
                ],
              ),
              h.h2([], ['Source links']),
              model.fields.linksError ? h.p([h.Role('alert')], [model.fields.linksError]) : h.empty,
              h.form(
                [h.Class('dashboard-panel dashboard-form'), h.OnSubmit(Message.AddCatalogLink())],
                [
                  field('platform', 'Platform'),
                  field('linkUrl', 'Link URL'),
                  h.button([h.Type('submit')], ['Add link']),
                ],
              ),
              h.ul(
                [h.Class('dashboard-list session-list')],
                model.rows.map((row) =>
                  h.li(
                    [h.Key(row.id)],
                    [
                      h.div([], [h.strong([], [row.title]), h.small([], [row.detail])]),
                      h.button(
                        [h.OnClick(Message.DeleteCatalogLink({ id: row.id }))],
                        ['Remove link'],
                      ),
                    ],
                  ),
                ),
              ),
              h.details(
                [],
                [
                  h.summary([], ['Delete entity']),
                  h.p([], ['Permanently delete this entity? This cannot be undone.']),
                  h.button([h.OnClick(Message.DeleteCatalogEntity())], ['Confirm delete entity']),
                ],
              ),
            ],
          ),
    ],
  )
}
