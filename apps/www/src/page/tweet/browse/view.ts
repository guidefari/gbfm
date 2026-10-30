import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../../message'
import type { Model } from '../../../model'
import { view as tweetView } from '../view'
import { browseFilters } from './filters'
import { browseHref } from './links'
import { browseRow } from './row'
import { PreserveBrowseScroll } from './scroll'

export const browseView = (model: Model, h: HtmlBuilder<Message>) => {
  const data = model.flags.tweetBrowse

  if (!data)
    return h.section(
      [h.Class('page')],
      [
        h.p([h.Role('alert')], ['Browse is unavailable.']),
        h.a([h.Href('/tweets')], ['Continue reading']),
      ],
    )
  const currentHref = browseHref(data.month, data.page)

  return h.section(
    [
      h.Class('tweet-browser'),
      ...(data.selected ? [h.DataAttribute('selected', data.selected)] : []),
    ],
    [
      h.header(
        [h.Class('tweet-browser-heading')],
        [
          h.div(
            [],
            [
              h.p([h.Class('tweet-browse-eyebrow')], ['THE ARCHIVE']),
              h.h1([], ['Browse tweets']),
              h.p([], ['Thoughts, records, and things worth sharing.']),
            ],
          ),
          h.a([h.Href('/tweets'), h.Class('btn btn-quiet')], ['Continue reading']),
        ],
      ),
      h.div(
        [h.Class('tweet-browser-layout')],
        [
          h.aside(
            [
              h.Key(`browse-${data.month}-${data.page}`),
              h.Class('tweet-browser-sidebar'),
              h.AriaLabel('Browse tweets'),
            ],
            [
              browseFilters(h, data),
              h.div(
                [
                  h.Class('tweet-browser-list'),
                  h.Key(data.selected ?? 'browse'),
                  h.DataAttribute('browse-scroll', ''),
                  h.OnMount(
                    PreserveBrowseScroll({
                      key: `${model.flags.principal?.id ?? 'anonymous'}:${data.month}:${data.page}`,
                      selected: data.selected,
                    }),
                  ),
                ],
                [
                  data.failure
                    ? h.div(
                        [h.Class('p-4')],
                        [
                          h.p([h.Role('alert')], [data.failure]),
                          h.a([h.Href(currentHref), h.Class('btn')], ['Try again']),
                        ],
                      )
                    : h.empty,
                  !data.failure && !data.posts.length
                    ? h.p([h.Class('p-4')], ['No tweets in this date range.'])
                    : h.empty,
                  ...data.posts.map((post, index) =>
                    browseRow(
                      h,
                      post,
                      browseHref(data.month, data.page, post.slug),
                      data.selected === post.slug,
                      index === 0 ||
                        data.posts[index - 1]?.createdAt.slice(0, 7) !== post.createdAt.slice(0, 7),
                    ),
                  ),
                  h.nav(
                    [h.Class('tweet-browse-pagination'), h.AriaLabel('Archive pages')],
                    [
                      data.page > 0
                        ? h.a(
                            [h.Href(browseHref(data.month, data.page - 1)), h.Class('btn')],
                            ['Newer tweets'],
                          )
                        : h.empty,
                      data.hasMore
                        ? h.a(
                            [h.Href(browseHref(data.month, data.page + 1)), h.Class('btn')],
                            ['Older tweets'],
                          )
                        : h.empty,
                    ],
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('tweet-browser-reader')],
            data.selected
              ? [
                  h.a(
                    [h.Href(currentHref), h.Class('btn btn-quiet tweet-browse-back')],
                    ['← Back to browse'],
                  ),
                  tweetView(model, h),
                ]
              : [
                  h.div(
                    [h.Class('tweet-browse-invitation')],
                    [
                      h.p([h.Class('tweet-browse-eyebrow')], ['READ AT YOUR OWN PACE']),
                      h.h2([], ['Choose a tweet']),
                      h.p([], ['Read the full post and explore its music and replies.']),
                    ],
                  ),
                ],
          ),
        ],
      ),
    ],
  )
}
