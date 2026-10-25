import { inertHtml as h } from 'foldkit/html'

import { artwork } from '../../view/artwork'

interface ProfileItem {
  readonly slug: string
  readonly title: string | null
  readonly thumbnailUrl?: string | null
  readonly draft?: boolean
}

export const contentSection = (title: string, path: string, items: ReadonlyArray<ProfileItem>) =>
  items.length
    ? h.section(
        [h.Class('profile-section'), h.AriaLabel(title)],
        [
          h.div(
            [h.Class('profile-section-heading')],
            [h.h2([], [title]), h.span([h.Class('profile-section-count')], [String(items.length)])],
          ),
          h.div(
            [h.Class('profile-grid')],
            items.map((item) =>
              h.a(
                [h.Href(`/${path}/${encodeURIComponent(item.slug)}`), h.Class('profile-card')],
                [
                  'thumbnailUrl' in item
                    ? h.div([h.Class('profile-card-art')], [artwork(item.thumbnailUrl, '', '72px')])
                    : h.empty,
                  h.div(
                    [h.Class('profile-card-copy')],
                    [
                      h.h3([], [item.title || item.slug]),
                      item.draft ? h.span([h.Class('profile-draft')], ['Draft']) : h.empty,
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      )
    : h.empty
