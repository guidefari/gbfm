import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../../message'
import type { ContentItem, Model } from '../../model'
import * as Player from '../../player'
import { artwork } from '../../view/artwork'
import { link } from '../../view/link'

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

export const cardsView = (model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.Class('cards')],
    model.flags.items.map((item) =>
      h.article(
        [h.Class('card'), h.Key(item.id)],
        [
          artwork(item.imageUrl, '', '(max-width: 1023px) 45vw, 25vw'),
          h.div(
            [h.Class('card-copy')],
            [
              link(h, item.href, item.title, 'card-title'),
              item.meta ? h.small([], [item.meta]) : h.empty,
              item.description ? h.p([], [item.description]) : h.empty,
              item.audioUrl
                ? h.button(
                    [h.Disabled(!model.interactive), h.OnClick(playItem(item, item.audioUrl))],
                    ['Play'],
                  )
                : h.empty,
            ],
          ),
        ],
      ),
    ),
  )

export const listingView = (model: Model, h: HtmlBuilder<Message>, kind: string) =>
  h.section(
    [h.Class('page')],
    [
      h.h1([], [model.flags.title]),
      model.flags.failure ? h.p([h.Role('alert')], [model.flags.failure]) : h.empty,
      kind === 'tags'
        ? model.flags.items.length
          ? h.nav(
              [h.Class('detail-actions'), h.AriaLabel('Tags')],
              model.flags.items.map((item) => link(h, item.href, item.title)),
            )
          : h.p([], ['No tags yet.'])
        : cardsView(model, h),
    ],
  )

export const taggedPostsView = (model: Model, h: HtmlBuilder<Message>) =>
  h.section(
    [h.Class('page')],
    [
      h.h1([], [model.flags.title]),
      model.flags.failure
        ? h.p([h.Role('alert')], [model.flags.failure])
        : model.flags.items.length === 0
          ? h.p([], ['No posts with this tag yet.'])
          : cardsView(model, h),
    ],
  )
