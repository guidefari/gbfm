import type { HtmlBuilder } from 'foldkit/html'
import { defineView } from 'foldkit/submodel'

import { Message } from './message'
import type { Model } from './model'
import { navigation, sectionLabel } from './navigation'
import { catalogView, entityRoute } from './page/catalog'
import * as Playlists from './page/playlists'
import * as Sessions from './page/sessions'
import * as Shows from './page/shows'
import { telemetryView } from './page/telemetry'
import { usersView } from './page/users'
import { isAdminSection } from './section'

export interface ViewInputs {
  readonly role: Model['principal']['role']
  readonly url: string
}

const input = (h: HtmlBuilder<Message>, model: Model, name: string, label: string, type = 'text') =>
  h.label(
    [],
    [
      label,
      h.input([
        h.Type(type),
        h.Value(model.fields[name] ?? ''),
        h.OnInput((value) => Message.FieldChanged({ name, value })),
      ]),
    ],
  )

const toggle = (h: HtmlBuilder<Message>, model: Model, name: string, label: string) =>
  h.label(
    [h.Class('dashboard-toggle')],
    [
      h.span([], [label]),
      h.input([
        h.Type('checkbox'),
        h.Checked(model.toggles[name] ?? false),
        h.OnClick(Message.ToggleChanged({ name, value: !(model.toggles[name] ?? false) })),
      ]),
    ],
  )

const profile = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class('dashboard-panel dashboard-form')],
    [
      input(h, model, 'username', 'Username'),
      input(h, model, 'email', 'Email', 'email'),
      h.label(
        [],
        [
          'Bio',
          h.textarea([
            h.Value(model.fields.bio ?? ''),
            h.Rows(6),
            h.OnInput((value) => Message.FieldChanged({ name: 'bio', value })),
          ]),
        ],
      ),
      h.button(
        [
          h.Class('dashboard-button-primary'),
          h.OnClick(Message.SaveProfile()),
          h.Disabled(model.phase === 'saving'),
        ],
        [model.phase === 'saving' ? 'Saving…' : 'Save profile'],
      ),
    ],
  )

const preferences = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class('dashboard-panel')],
    [
      h.h2([], ['Email preferences']),
      toggle(h, model, 'mixReleaseEnabled', 'New mix and show updates'),
      toggle(h, model, 'promotionalEnabled', 'Promotional emails'),
      toggle(h, model, 'systemEnabled', 'System notifications'),
      toggle(h, model, 'globalUnsubscribe', 'Unsubscribe from all non-essential email'),
      h.button(
        [
          h.Class('dashboard-button-primary'),
          h.OnClick(Message.SaveEmailPreferences()),
          h.Disabled(model.phase === 'saving'),
        ],
        ['Save email preferences'],
      ),
    ],
  )

const rows = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class('dashboard-panel dashboard-library')],
    [
      model.rows.length === 0
        ? h.p(
            [h.Class('dashboard-empty')],
            [
              model.section === 'favorites' || model.section === 'overview'
                ? 'Your saved mixes and shows will appear here. Explore a show and save something you love.'
                : 'No items found.',
            ],
          )
        : h.ul(
            [h.Class('dashboard-list dashboard-library-list')],
            model.rows.map((row) =>
              h.li(
                [h.Key(row.id)],
                [
                  h.div(
                    [],
                    [
                      row.href ? h.a([h.Href(row.href)], [row.title]) : h.strong([], [row.title]),
                      row.detail ? h.small([], [row.detail]) : h.empty,
                    ],
                  ),
                  model.section === 'favorites' || model.section === 'reminders'
                    ? h.button(
                        [
                          h.Class('dashboard-button-quiet'),
                          h.AriaLabel(`Remove ${row.title}`),
                          h.OnClick(Message.DeleteRequested({ id: row.id })),
                        ],
                        ['Remove'],
                      )
                    : h.empty,
                ],
              ),
            ),
          ),
    ],
  )

export const view = defineView<Model, typeof Message.Type, ViewInputs>((model, inputs, h) => {
  const role = inputs.role

  const spotify = h.section(
    [h.Class(model.section === 'spotify-callback' ? 'page prose' : 'dashboard-panel')],
    [
      h.h2([], ['Spotify connection']),
      h.p([], ['Connect Spotify to play and queue tracks from music cards.']),
      model.phase === 'loading' ? h.p([h.Role('status')], ['Connecting Spotify…']) : h.empty,
      model.error ? h.p([h.Role('alert')], [model.error]) : h.empty,
      model.spotify.connected ? h.p([], [`Connected as ${model.spotify.name}`]) : h.empty,
      model.section === 'spotify-callback'
        ? h.a([h.Href('/dashboard/integrations')], ['Back to integrations'])
        : h.div(
            [],
            [
              h.button(
                [
                  h.Disabled(model.phase === 'loading'),
                  h.OnClick(
                    Message.SpotifyRequested({
                      action: model.spotify.connected ? 'disconnect' : 'connect',
                    }),
                  ),
                ],
                [model.spotify.connected ? 'Disconnect Spotify' : 'Connect Spotify'],
              ),
              h.button(
                [
                  h.Disabled(model.phase === 'loading'),
                  h.OnClick(Message.SpotifyRequested({ action: 'status' })),
                ],
                ['Refresh session'],
              ),
            ],
          ),
    ],
  )

  if (model.section === 'spotify-callback') return spotify

  if (isAdminSection(model.section) && role !== 'admin')
    return h.section(
      [h.Class('dashboard-forbidden')],
      [
        h.h1([], ['Administrator access required']),
        h.p([], ['This area is not available to your account.']),
      ],
    )

  const entity = entityRoute(model.section)

  const content =
    model.section === 'users'
      ? usersView(
          model.users,
          model.fields.search ?? '',
          Number(model.fields.offset ?? '0'),
          new URL(inputs.url).searchParams.get('notice') ?? '',
        )
      : model.section === 'sessions'
        ? h.submodel({
            slotId: 'sessions',
            view: Sessions.view,
            model: model.sessions,
            toParentMessage: (message) => Message.GotSessionMessage({ message }),
          })
        : model.section === 'integrations'
          ? spotify
          : model.section === 'playlists' && model.phase === 'ready'
            ? h.submodel({
                slotId: 'playlists',
                view: Playlists.view,
                model: model.playlists,
                toParentMessage: (message) => Message.GotPlaylistMessage({ message }),
              })
            : (model.section === 'music' || entity) && model.phase !== 'loading'
              ? catalogView(model, h, Message)
              : model.phase === 'loading'
                ? h.p([h.Class('dashboard-state')], ['Loading…'])
                : model.phase === 'error'
                  ? h.div(
                      [h.Class('dashboard-state dashboard-error'), h.Role('alert')],
                      [
                        h.p([], [model.error ?? 'Could not load this dashboard section.']),
                        h.button([h.OnClick(Message.LoadRequested())], ['Try again']),
                      ],
                    )
                  : model.section === 'frontend-errors'
                    ? h.div(
                        [],
                        [
                          h.button([h.OnClick(Message.LoadRequested())], ['Refresh telemetry']),
                          telemetryView(model.telemetry),
                        ],
                      )
                    : model.section === 'shows'
                      ? h.submodel({
                          slotId: 'shows',
                          view: Shows.view,
                          model: model.shows,
                          toParentMessage: (message) => Message.GotShowMessage({ message }),
                        })
                      : model.section === 'profile'
                        ? profile(model, h)
                        : model.section === 'email'
                          ? preferences(model, h)
                          : model.section === 'search'
                            ? h.section(
                                [h.Class('dashboard-panel')],
                                [
                                  h.h2([], ['Search']),
                                  input(h, model, 'query', 'Query', 'search'),
                                  h.button([h.OnClick(Message.SearchRequested())], ['Search']),
                                  rows(model, h),
                                ],
                              )
                            : model.section === 'player'
                              ? h.section(
                                  [h.Class('dashboard-panel')],
                                  [
                                    h.h2([], ['Player preferences']),
                                    h.p([], ['Player settings are stored on this device.']),
                                    toggle(h, model, 'continueQueue', 'Continue through queue'),
                                    toggle(
                                      h,
                                      model,
                                      'restorePosition',
                                      'Restore listening position',
                                    ),
                                    h.button(
                                      [
                                        h.Class('dashboard-button-primary'),
                                        h.OnClick(Message.SavePlayerPreferences()),
                                        h.Disabled(model.phase === 'saving'),
                                      ],
                                      [
                                        model.phase === 'saving'
                                          ? 'Saving…'
                                          : 'Save player preferences',
                                      ],
                                    ),
                                  ],
                                )
                              : model.section === 'appearance'
                                ? h.section(
                                    [h.Class('appearance-options')],
                                    [
                                      h.p([], ['Choose how gbfm looks on this device']),
                                      ...(['light', 'dark', 'system'] as const).map((theme) =>
                                        h.button(
                                          [
                                            h.AriaPressed(
                                              String((model.fields.theme ?? 'system') === theme),
                                            ),
                                            h.OnClick(Message.ThemeSelected({ theme })),
                                          ],
                                          [
                                            h.strong(
                                              [],
                                              [theme.charAt(0).toUpperCase() + theme.slice(1)],
                                            ),
                                            h.span(
                                              [],
                                              [
                                                theme === 'system'
                                                  ? 'Follow your device preference'
                                                  : `Always use the ${theme} interface`,
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  )
                                : rows(model, h)

  return h.div(
    [h.Class('gbfm-dashboard')],
    [
      h.aside(
        [h.Class('dashboard-sidebar')],
        [
          h.a([h.Href('/dashboard'), h.Class('dashboard-brand')], ['Dashboard']),
          navigation(h, model.section, role),
        ],
      ),
      h.div(
        [h.Class('dashboard-mobile-header')],
        [
          h.a([h.Href('/dashboard'), h.Class('dashboard-brand')], ['Dashboard']),
          h.details(
            [h.Key(model.section), h.Class('dashboard-section-picker')],
            [h.summary([], ['Sections']), navigation(h, model.section, role)],
          ),
        ],
      ),
      h.section(
        [h.Class('dashboard-content')],
        [
          h.header(
            [h.Class('dashboard-heading')],
            [
              h.h1(
                [],
                [
                  model.section === 'overview'
                    ? 'Your dashboard'
                    : entity
                      ? `Edit ${entity.kind}`
                      : sectionLabel(model.section, role),
                ],
              ),
            ],
          ),
          content,
        ],
      ),
    ],
  )
})
