import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../message'
import type { ContentItem, Model } from '../model'
import * as Player from '../player'
import * as PublicActions from '../public-actions'
import { richContent } from '../rich-content/fallback'
import { richContentView } from '../rich-content/render'
import { artwork } from './artwork'

export const link = (h: HtmlBuilder<Message>, href: string, label: string, className = '') =>
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

export const detailView = (model: Model, h: HtmlBuilder<Message>, kind: string) => {
  const item = model.flags.items[0]

  if (!item)
    return h.section(
      [h.Class('page')],
      [h.p([h.Role('alert')], [model.flags.failure ?? 'Content not found.'])],
    )
  const current = model.player.snapshot.queue.current?.id === item.id
  const playing = current && model.player.snapshot.transport.isPlaying

  return h.article(
    [h.Class('content-detail')],
    [
      kind === 'mixes' ? link(h, '/shows', '← Radio shows') : h.empty,
      h.header(
        [],
        [
          artwork(item.imageUrl, item.title, '(max-width: 639px) 90vw, 240px', true),
          h.div(
            [],
            [
              h.p([h.Class('eyebrow')], [kind]),
              h.h1([], [item.title]),
              item.description ? h.p([], [item.description]) : h.empty,
              h.p(
                [h.Class('detail-creators')],
                (item.creators ?? []).map((creator) =>
                  link(
                    h,
                    `/profile/${encodeURIComponent(creator.username ?? creator.id)}`,
                    creator.name,
                  ),
                ),
              ),
              item.meta
                ? h.time(
                    [h.Datetime(item.meta)],
                    [
                      new Date(item.meta).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      }),
                    ],
                  )
                : h.empty,
            ],
          ),
        ],
      ),
      item.audioUrl
        ? h.div(
            [h.Class('detail-actions')],
            [
              h.button(
                [
                  h.Disabled(!model.interactive),
                  h.OnClick(
                    current
                      ? Message.GotPlayerMessage({ message: Player.Message.TogglePlayPause() })
                      : playItem(item, item.audioUrl),
                  ),
                ],
                [playing ? 'Pause' : 'Play'],
              ),
              h.button(
                [
                  h.Disabled(!model.interactive),
                  h.OnClick(
                    Message.GotPlayerMessage({
                      message: Player.Message.Enqueue({
                        track: {
                          id: item.id,
                          title: item.title,
                          url: item.audioUrl,
                          slug: item.slug,
                          thumbnailUrl: item.imageUrl,
                          type: item.audioType ?? 'mix',
                          creators: item.creators,
                        },
                      }),
                    }),
                  ),
                ],
                ['Add to queue'],
              ),
            ],
          )
        : h.empty,
      PublicActions.view(
        model.publicAction,
        h,
        (message) => Message.GotPublicActionMessage({ message }),
        model.interactive,
      ),
      h.nav(
        [h.Class('detail-actions'), h.AriaLabel('Listen on')],
        (item.streamingLinks ?? []).map((stream) =>
          h.a(
            [h.Href(stream.url), h.Target('_blank'), h.Rel('noopener noreferrer')],
            [stream.platform],
          ),
        ),
      ),
      h.nav(
        [h.Class('detail-actions'), h.AriaLabel('Content tags')],
        (item.tags ?? []).map((tag) => link(h, `/tags/${encodeURIComponent(tag)}`, `#${tag}`)),
      ),
      item.richContent === null ? richContent(item.content) : richContentView(item.richContent, h),
    ],
  )
}
