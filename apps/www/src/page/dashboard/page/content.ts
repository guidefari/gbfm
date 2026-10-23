import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../message'
import type { Model } from '../model'
import { sectionHref } from '../navigation'
import { badge, dataTable, emptyState, frame, pageHeader, pageRange, pager } from '../ui'

const contentKinds = new Map([
  ['mixes', { action: 'New mix', href: '/mix-upload', label: 'Mixes', noun: 'mixes' }],
  ['tweets', { action: 'New tweet', href: '/new/tweet', label: 'Tweets', noun: 'tweets' }],
  [
    'editorial',
    { action: 'New post', href: '/new/editorial', label: 'Editorial', noun: 'editorial posts' },
  ],
])

export const isContentList = (section: string) =>
  (section.startsWith('all/') || section.startsWith('content/')) &&
  contentKinds.has(section.split('/')[1] ?? '')

export const contentListView = (model: Model, h: HtmlBuilder<Message>) => {
  const kind = contentKinds.get(model.section.split('/')[1] ?? '')
  const page = model.pagination
  const href = (offset: number) => `${sectionHref(model.section)}?offset=${offset}`

  return h.div(
    [h.Class('admin-page')],
    [
      kind
        ? pageHeader(
            h,
            model.section.startsWith('all/')
              ? `All ${kind.noun} on the site, from every author.`
              : `The ${kind.noun} you published or drafted.`,
            [h.a([h.Href(kind.href), h.Class('admin-link-button')], [kind.action])],
          )
        : h.empty,
      model.phase === 'error'
        ? h.p(
            [h.Role('alert'), h.Class('admin-notice')],
            [model.error ?? 'Could not load this list.'],
          )
        : h.empty,
      frame(h, [
        dataTable(h, {
          label: kind?.label ?? 'Content',
          loading: model.phase === 'loading',
          minWidth: '28rem',
          columns: [
            { label: 'Title' },
            { label: 'Status', width: '7.5rem' },
            { label: '', className: 'admin-col-actions', width: '4.5rem' },
          ],
          rows: model.rows.map((row) => ({
            key: row.id,
            cells: [
              h.strong([], [row.title]),
              row.status === 'Published'
                ? badge(h, 'Published', 'ok')
                : badge(h, row.status ?? 'Draft', 'neutral'),
              row.href
                ? h.a([h.Class('admin-pager-control'), h.Href(row.href)], ['Edit'])
                : h.empty,
            ],
          })),
          empty: emptyState(h, kind ? `No ${kind.noun} yet.` : 'No items found.'),
        }),
        page && model.rows.length > 0
          ? pager(h, {
              label: 'Content pages',
              summary: pageRange(page.offset, model.rows.length, page.total),
              previous:
                page.offset > 0 ? { href: href(Math.max(0, page.offset - page.limit)) } : null,
              next: page.hasMore ? { href: href(page.offset + page.limit) } : null,
            })
          : h.empty,
      ]),
    ],
  )
}
