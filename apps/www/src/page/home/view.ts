import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../../message'
import type { ContentItem, Model } from '../../model'
import * as Player from '../../player'
import { artwork } from '../../view/artwork'

const link = (h: HtmlBuilder<Message>, href: string, label: string, className = '') =>
  h.a([h.Href(href), h.Class(className)], [label])

const playItem = (item: ContentItem, url: string) =>
  Message.GotPlayerMessage({
    message: Player.Message.PlayTrack({
      track: {
        id: item.id,
        title: item.title,
        url,
        slug: item.slug,
        thumbnailUrl: item.imageUrl,
        type: item.audioType ?? 'mix',
        creators: item.creators,
      },
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>) => {
  const mix = model.flags.items[0]

  return h.section(
    [h.Class('home')],
    [
      h.h1([], ['goosebumps.', h.br([]), h.span([], ['fm'])]),
      h.div(
        [h.Class('featured')],
        [
          h.div(
            [h.Class('featured-art')],
            [
              artwork(mix?.imageUrl, mix?.title ?? 'goosebumps.fm', '320px', true),
              h.div(
                [h.Class('featured-overlay')],
                [
                  h.span([h.Class('featured-label')], ['Featured']),
                  h.div(
                    [],
                    [
                      mix
                        ? link(h, mix.href, mix.title, 'featured-title')
                        : h.p([], ['No featured mix available']),
                      mix?.creators
                        ? h.p(
                            [h.Class('featured-creators')],
                            [mix.creators.map((creator) => creator.name).join(', ')],
                          )
                        : h.empty,
                      mix?.audioUrl
                        ? h.button(
                            [
                              h.Disabled(!model.interactive),
                              h.OnClick(playItem(mix, mix.audioUrl)),
                            ],
                            ['▶ Play mix'],
                          )
                        : h.empty,
                    ],
                  ),
                ],
              ),
            ],
          ),
          link(h, '/shows', '◉ Browse radio shows', 'browse-shows'),
        ],
      ),
    ],
  )
}
