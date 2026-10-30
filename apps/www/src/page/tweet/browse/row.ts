import type { MicroPostListPost } from '@gbfm/api/post'
import { browseExcerpt, browseMonthLabel } from '@gbfm/core/tweet-browse'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../../message'
import { artwork } from '../../../view/artwork'
import { formatDate } from '../../../view/format-date'

export const browseRow = (
  h: HtmlBuilder<Message>,
  post: MicroPostListPost,
  href: string,
  selected: boolean,
  showMonth: boolean,
) => {
  const music = post.music?.entity
  const excerpt = browseExcerpt(post) || music?.title || 'Open tweet'

  return h.div(
    [h.Key(post.slug)],
    [
      showMonth
        ? h.h2([h.Class('tweet-browse-month')], [browseMonthLabel(post.createdAt.slice(0, 7))])
        : h.empty,
      h.a(
        [
          h.Href(href),
          h.DataAttribute('tweet-date', post.createdAt),
          h.AriaLabel(`Read tweet: ${excerpt}`),
          h.AriaCurrent(selected ? 'page' : 'false'),
          h.Class('tweet-browse-row'),
        ],
        [
          h.div(
            [h.Class('tweet-browse-meta')],
            [
              h.span([], [formatDate(post.createdAt)]),
              (post.replyCount ?? 0) > 0
                ? h.span([], [`${post.replyCount} ${post.replyCount === 1 ? 'reply' : 'replies'}`])
                : h.empty,
            ],
          ),
          h.div(
            [h.Class('tweet-browse-row-body')],
            [
              h.div(
                [],
                [
                  h.p([h.Class('tweet-browse-excerpt')], [excerpt]),
                  music
                    ? h.p(
                        [h.Class('tweet-browse-record')],
                        [
                          music.title,
                          music.artistNames?.length ? ` · ${music.artistNames.join(', ')}` : '',
                        ],
                      )
                    : h.empty,
                  post.tags?.length
                    ? h.p(
                        [h.Class('tweet-browse-tags')],
                        [
                          post.tags
                            .slice(0, 3)
                            .map((tag) => `#${tag}`)
                            .join('  '),
                        ],
                      )
                    : h.empty,
                ],
              ),
              music?.coverImageUrl
                ? artwork(
                    music.coverImageUrl,
                    `${music.title} cover`,
                    '72px',
                    false,
                    'tweet-browse-artwork',
                  )
                : h.empty,
            ],
          ),
        ],
      ),
    ],
  )
}
