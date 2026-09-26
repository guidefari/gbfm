import { canCreatePosts } from '@gbfm/core/roles'
import type { HtmlBuilder } from 'foldkit/html'
import { defineView } from 'foldkit/submodel'

import { isAdminSection, Message, type Model } from './model'

export interface ViewInputs {
  readonly role: Model['principal']['role']
}

const memberNav = [
  ['overview', 'Home'],
  ['profile', 'Profile'],
  ['email', 'Email'],
  ['player', 'Player'],
  ['favorites', 'Favorites'],
  ['reminders', 'Reminders'],
] as const

const creatorNav = [
  ['content/mixes', 'My mixes'],
  ['content/tweets', 'My tweets'],
  ['content/editorial', 'My editorial'],
] as const

const adminNav = [
  ['admin', 'Admin'],
  ['users', 'Users'],
  ['sessions', 'Sessions'],
  ['shows', 'Shows'],
  ['music', 'Music'],
  ['playlists', 'Playlists'],
  ['search', 'Search'],
  ['newsletter', 'Newsletter'],
  ['email-logs', 'Email logs'],
  ['frontend-errors', 'Telemetry'],
  ['all/mixes', 'All content'],
] as const

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
      h.h2([], ['Profile']),
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
        [h.OnClick(Message.SaveProfile()), h.Disabled(model.phase === 'saving')],
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
        [h.OnClick(Message.SaveEmailPreferences()), h.Disabled(model.phase === 'saving')],
        ['Save email preferences'],
      ),
    ],
  )

const rows = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class('dashboard-panel')],
    [
      h.h2([], [model.section.replaceAll('/', ' / ')]),
      model.rows.length === 0
        ? h.p([h.Class('dashboard-empty')], ['No items found.'])
        : h.ul(
            [h.Class('dashboard-list')],
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
                    ? h.button([h.OnClick(Message.DeleteRequested({ id: row.id }))], ['Remove'])
                    : h.empty,
                ],
              ),
            ),
          ),
    ],
  )

export const view = defineView<Model, typeof Message.Type, ViewInputs>((model, inputs, h) => {
  const role = inputs.role

  if (isAdminSection(model.section) && role !== 'admin')
    return h.section(
      [h.Class('dashboard-forbidden')],
      [
        h.h1([], ['Administrator access required']),
        h.p([], ['This area is not available to your account.']),
      ],
    )

  const links = [
    ...memberNav,
    ...(canCreatePosts(role) ? creatorNav : []),
    ...(role === 'admin' ? adminNav : []),
  ]

  const content =
    model.phase === 'loading'
      ? h.p([h.Class('dashboard-state')], ['Loading…'])
      : model.phase === 'error'
        ? h.div(
            [h.Class('dashboard-state dashboard-error'), h.Role('alert')],
            [
              h.p([], [model.error ?? 'Could not load this dashboard section.']),
              h.button([h.OnClick(Message.LoadRequested())], ['Try again']),
            ],
          )
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
                      toggle(h, model, 'restorePosition', 'Restore listening position'),
                    ],
                  )
                : rows(model, h)

  return h.div(
    [h.Class('gbfm-dashboard')],
    [
      h.aside(
        [],
        [
          h.a([h.Href('/dashboard'), h.Class('dashboard-brand')], ['Dashboard']),
          h.nav(
            [h.AriaLabel('Dashboard')],
            links.map(([section, label]) =>
              h.a(
                [
                  h.Href(`/dashboard/${section}`),
                  h.Class(section === model.section ? 'active' : ''),
                ],
                [label],
              ),
            ),
          ),
        ],
      ),
      h.section(
        [h.Class('dashboard-content')],
        [
          h.header(
            [h.Class('dashboard-heading')],
            [
              h.p([], ['GOOSEBUMPS FM']),
              h.h1(
                [],
                [
                  model.section === 'overview'
                    ? 'Your dashboard'
                    : model.section.replaceAll('-', ' '),
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
