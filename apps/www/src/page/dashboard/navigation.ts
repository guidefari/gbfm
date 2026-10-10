import { canCreatePosts } from '@gbfm/core/roles'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from './message'
import type { Model } from './model'

interface NavigationLink {
  readonly section: string
  readonly label: string
}

interface NavigationGroup {
  readonly label: string
  readonly links: ReadonlyArray<NavigationLink>
}

const library: NavigationGroup = {
  label: 'Library',
  links: [
    { section: 'overview', label: 'Home' },
    { section: 'favorites', label: 'Favorites' },
    { section: 'reminders', label: 'Reminders' },
  ],
}

const creator: NavigationGroup = {
  label: 'Creator',
  links: [
    { section: 'content/mixes', label: 'My mixes' },
    { section: 'content/tweets', label: 'My tweets' },
    { section: 'content/editorial', label: 'My editorial' },
  ],
}

const admin: NavigationGroup = {
  label: 'Admin',
  links: [
    { section: 'admin', label: 'Overview' },
    { section: 'users', label: 'Users' },
    { section: 'sessions', label: 'Sessions' },
    { section: 'shows', label: 'Shows' },
    { section: 'music', label: 'Music' },
    { section: 'playlists', label: 'Playlists' },
    { section: 'search', label: 'Search' },
    { section: 'newsletter', label: 'Newsletter' },
    { section: 'email-logs', label: 'Email logs' },
    { section: 'frontend-errors', label: 'Telemetry' },
    { section: 'all/mixes', label: 'All content' },
    { section: 'featured-mix', label: 'Featured mix' },
  ],
}

const account: NavigationGroup = {
  label: 'Account',
  links: [
    { section: 'profile', label: 'Profile' },
    { section: 'appearance', label: 'Appearance' },
    { section: 'email', label: 'Email' },
    { section: 'player', label: 'Player' },
    { section: 'integrations', label: 'Integrations' },
  ],
}

const isCurrent = (section: string, current: string) =>
  section === current ||
  (section === 'all/mixes' && current.startsWith('all/')) ||
  (section === 'music' && current.startsWith('music-entity/'))

const groupsFor = (role: Model['principal']['role']) => [
  library,
  ...(canCreatePosts(role) ? [creator] : []),
  ...(role === 'admin' ? [admin] : []),
  account,
]

export const sectionLabel = (section: string, role: Model['principal']['role']) =>
  groupsFor(role)
    .flatMap((group) => group.links)
    .find((link) => link.section === section)?.label ?? section.replaceAll('-', ' ')

export const navigation = (
  h: HtmlBuilder<Message>,
  section: string,
  role: Model['principal']['role'],
) =>
  h.div(
    [h.Class('dashboard-navigation')],
    [
      h.nav(
        [h.AriaLabel('Dashboard sections')],
        groupsFor(role).map((group) =>
          h.div(
            [h.Class('dashboard-nav-group')],
            [
              h.p([h.Class('dashboard-nav-label')], [group.label]),
              ...group.links.map((link) =>
                h.a(
                  [
                    h.Href(`/dashboard/${link.section}`),
                    h.Class(isCurrent(link.section, section) ? 'active' : ''),
                    ...(isCurrent(link.section, section) ? [h.AriaCurrent('page')] : []),
                  ],
                  [link.label],
                ),
              ),
            ],
          ),
        ),
      ),
      h.form(
        [h.Method('post'), h.Action('/actions/sign-out'), h.Class('dashboard-sign-out')],
        [h.button([h.Type('submit'), h.Class('dashboard-button-quiet')], ['Sign out'])],
      ),
    ],
  )
