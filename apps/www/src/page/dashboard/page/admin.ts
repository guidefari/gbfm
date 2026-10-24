import type { AdminOverviewResponse } from '@gbfm/api/admin'
import type { HtmlBuilder } from 'foldkit/html'

import type { Row } from '../document'
import type { Message } from '../message'
import { sectionHref, workspaces } from '../navigation'

type Highlights = AdminOverviewResponse['highlights']

const highlightLabels: ReadonlyArray<{ readonly key: keyof Highlights; readonly label: string }> = [
  { key: 'totalUsers', label: 'Users' },
  { key: 'verifiedUsers', label: 'Verified users' },
  { key: 'newsletterSubscribers', label: 'Subscribers' },
  { key: 'totalPlayCount', label: 'Total plays' },
  { key: 'publishedMixes', label: 'Published mixes' },
  { key: 'newUsersLast7Days', label: 'New users (7 days)' },
  { key: 'newSubscribersLast30Days', label: 'New subscribers (30 days)' },
  { key: 'newMixesLast30Days', label: 'New mixes (30 days)' },
]

const count = new Intl.NumberFormat('en')

export const highlightRows = (highlights: Highlights): ReadonlyArray<typeof Row.Type> =>
  highlightLabels.map(({ key, label }) => ({
    id: key,
    title: label,
    detail: count.format(highlights[key]),
    href: null,
    actionId: null,
  }))

export const adminHub = (h: HtmlBuilder<Message>, rows: ReadonlyArray<typeof Row.Type>) =>
  h.div(
    [h.Class('admin-hub')],
    [
      h.dl(
        [h.Class('admin-stats')],
        rows.map((row) => h.div([h.Key(row.id)], [h.dt([], [row.title]), h.dd([], [row.detail])])),
      ),
      h.ul(
        [h.Class('admin-tasks')],
        workspaces.admin.groups
          .filter((group) => group.pages.length > 1)
          .map((group) =>
            h.li(
              [h.Key(group.label)],
              [
                h.h2([], [h.a([h.Href(sectionHref(group.pages[0].section))], [group.label])]),
                h.p([], [group.description]),
                h.nav(
                  [h.AriaLabel(`${group.label} pages`)],
                  group.pages.map((page) => h.a([h.Href(sectionHref(page.section))], [page.label])),
                ),
              ],
            ),
          ),
      ),
    ],
  )
