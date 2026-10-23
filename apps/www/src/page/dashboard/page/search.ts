import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../message'
import type { Model } from '../model'
import { dataTable, emptyState, frame } from '../ui'

const typeLabels = new Map([
  ['Show', 'Show'],
  ['mix', 'Mix'],
  ['micro', 'Tweet'],
  ['post', 'Editorial'],
])

export const searchView = (model: Model, url: string, h: HtmlBuilder<Message>) => {
  const query = new URL(url).searchParams.get('q')?.trim() ?? ''

  return frame(h, [
    h.form(
      [h.Method('get'), h.Action('/dashboard/search'), h.Role('search'), h.Class('admin-toolbar')],
      [
        h.input([
          h.Type('search'),
          h.Name('q'),
          h.AriaLabel('Search content'),
          h.Placeholder('Search shows, mixes and posts'),
          h.Attribute('value', query),
        ]),
        h.button([h.Type('submit')], ['Search']),
      ],
    ),
    query === ''
      ? emptyState(h, 'Search shows, mixes and posts.')
      : model.phase === 'error'
        ? h.p([h.Role('alert'), h.Class('admin-empty')], [model.error ?? 'Search failed.'])
        : dataTable(h, {
            label: 'Search results',
            loading: model.phase === 'loading',
            columns: [{ label: 'Title', className: 'admin-col-wide' }, { label: 'Type' }],
            rows: model.rows.map((row) => ({
              key: row.id,
              cells: [
                row.href ? h.a([h.Href(row.href)], [row.title]) : row.title,
                typeLabels.get(row.detail) ?? row.detail,
              ],
            })),
            empty: emptyState(h, `Nothing matches "${query}".`),
          }),
  ])
}
