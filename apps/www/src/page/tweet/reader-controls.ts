import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../../message'
import type { Model } from '../../model'
import { iconPaths, lucide } from '../../view/icons'
import * as Reader from './reader'

export const readerControls = (
  model: Model,
  h: HtmlBuilder<Message>,
  slug: string,
  neighbours: MicroPostNeighboursResponse | null,
) => {
  const target = Reader.nextUnread(neighbours)

  const linkClass =
    'inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs text-muted-foreground no-underline hover:bg-muted/60 hover:text-foreground'

  const nextUnreadLabel = (direction: 'older' | 'newer' | null) => [
    'Next unread',
    direction ? h.span([h.Class('text-muted-foreground/60')], [`(${direction})`]) : h.empty,
  ]

  const checking = model.interactive && model.tweetReader.metadataStatus === 'loading'

  const stale = Reader.nextUnread(model.tweetReader.lastKnown)

  const staleDirection = Reader.UnreadTarget.$is('Older')(stale)
    ? 'older'
    : Reader.UnreadTarget.$is('Newer')(stale)
      ? 'newer'
      : null

  return h.div(
    [h.Class('flex flex-wrap items-center gap-1')],
    [
      h.a([h.Href('/tweet/latest'), h.Class(linkClass)], ['Latest']),
      Reader.UnreadTarget.$match(target, {
        Older: ({ slug }) =>
          h.a(
            [h.Href(`/tweet/${encodeURIComponent(slug)}`), h.Class(linkClass)],
            nextUnreadLabel('older'),
          ),
        Newer: ({ slug }) =>
          h.a(
            [h.Href(`/tweet/${encodeURIComponent(slug)}`), h.Class(linkClass)],
            nextUnreadLabel('newer'),
          ),
        CaughtUp: () => h.span([h.Role('status'), h.Class('px-2')], ['Caught up']),
        Unavailable: () =>
          checking
            ? h.span(
                [
                  h.Role('status'),
                  h.AriaLabel('Checking unread'),
                  h.Class(`${linkClass} pointer-events-none opacity-40`),
                ],
                nextUnreadLabel(staleDirection),
              )
            : h.span([h.Role('status'), h.Class('px-2')], ['Unread navigation unavailable']),
      }),
      model.tweetReader.metadataStatus === 'error'
        ? h.button(
            [
              h.Type('button'),
              h.OnClick(
                Message.GotTweetReaderMessage({ message: Reader.Message.RetryNavigation() }),
              ),
              h.Class(linkClass),
            ],
            ['Retry navigation'],
          )
        : h.empty,
      h.form(
        [h.Method('post'), h.Action('/actions/tweet-random'), h.Class('m-0')],
        [
          h.input([h.Type('hidden'), h.Name('slug'), h.Value(slug)]),
          h.button(
            [
              h.Type('submit'),
              h.Disabled(Reader.UnreadTarget.$is('CaughtUp')(target)),
              h.Class(
                `${linkClass} border-0 bg-transparent disabled:cursor-not-allowed disabled:opacity-40`,
              ),
            ],
            [lucide(iconPaths.shuffle, 'h-3.5 w-3.5'), 'Random unread'],
          ),
        ],
      ),
      model.tweetReader.failed.includes(slug)
        ? h.div(
            [h.Role('alert'), h.Class('w-full')],
            [
              'Reading history could not be saved. ',
              h.button(
                [
                  h.Type('button'),
                  h.OnClick(Message.GotTweetReaderMessage({ message: Reader.Message.RetrySeen() })),
                  h.Class(linkClass),
                ],
                ['Retry saving history'],
              ),
            ],
          )
        : h.empty,
    ],
  )
}
