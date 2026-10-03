import type { HtmlBuilder } from 'foldkit/html'

import { artwork } from '../../view/artwork'
import { lucide } from '../../view/icons'
import { Message } from './message'
import type { Model } from './model'

export const collection = (model: Model, h: HtmlBuilder<Message>) => {
  const hasArtwork = ['favorites', 'overview', 'reminders'].includes(model.section)

  return h.section(
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
            model.rows.map((row) => {
              const content = [
                ...(hasArtwork
                  ? [
                      artwork(
                        row.thumbnailUrl,
                        '',
                        '(max-width: 767px) 48px, 64px',
                        false,
                        'dashboard-thumbnail',
                      ),
                    ]
                  : []),
                h.div(
                  [h.Class('dashboard-item-copy')],
                  [h.strong([], [row.title]), row.detail ? h.small([], [row.detail]) : h.empty],
                ),
              ]

              return h.li(
                [h.Key(row.id)],
                [
                  row.href
                    ? h.a([h.Href(row.href), h.Class('dashboard-library-item')], content)
                    : h.div([h.Class('dashboard-library-item')], content),
                  model.section === 'favorites' || model.section === 'reminders'
                    ? h.button(
                        [
                          h.Class('dashboard-button-quiet dashboard-remove'),
                          h.AriaLabel(`Remove ${row.title}`),
                          h.Title(`Remove ${row.title}`),
                          h.OnClick(Message.DeleteRequested({ id: row.id })),
                        ],
                        [
                          lucide('M18 6 6 18 M6 6l12 12', 'dashboard-remove-icon'),
                          h.span([h.Class('dashboard-remove-label')], ['Remove']),
                        ],
                      )
                    : h.empty,
                ],
              )
            }),
          ),
    ],
  )
}
