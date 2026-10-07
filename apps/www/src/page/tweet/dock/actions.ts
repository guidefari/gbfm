import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import type { HtmlBuilder } from 'foldkit/html'

import { Message } from '../../../message'
import { iconPaths, lucide } from '../../../view/icons'
import * as Reader from '../reader'

const baseButton =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-sm border px-3 text-sm no-underline transition-colors'

export const primaryButton = `${baseButton} w-full border-highlight/50 bg-highlight/10 text-highlight hover:bg-highlight/20`

export const secondaryButton = `${baseButton} border-border bg-card/60 text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40`

const resetForm = (h: HtmlBuilder<Message>, slug: string, label: string, className: string) =>
  h.form(
    [h.Method('post'), h.Action('/actions/tweet-reset'), h.Class('m-0')],
    [
      h.input([h.Type('hidden'), h.Name('slug'), h.Value(slug)]),
      h.button([h.Type('submit'), h.Class(`${className} w-full cursor-pointer`)], [label]),
    ],
  )

const nextUnread = (
  h: HtmlBuilder<Message>,
  slug: string,
  target: ReturnType<typeof Reader.nextUnread>,
  checking: boolean,
  failed: boolean,
) =>
  Reader.UnreadTarget.$match(target, {
    Older: ({ slug: next }) =>
      h.a(
        [
          h.Href(`/tweet/${encodeURIComponent(next)}`),
          h.AriaLabel('Next unread (older)'),
          h.Class(primaryButton),
        ],
        [
          'Next unread',
          h.span([h.Class('opacity-60')], ['older']),
          lucide(iconPaths.chevronRight, 'h-4 w-4'),
        ],
      ),
    Newer: ({ slug: next }) =>
      h.a(
        [
          h.Href(`/tweet/${encodeURIComponent(next)}`),
          h.AriaLabel('Next unread (newer)'),
          h.Class(primaryButton),
        ],
        [
          lucide(iconPaths.chevronLeft, 'h-4 w-4'),
          'Next unread',
          h.span([h.Class('opacity-60')], ['newer']),
        ],
      ),
    CaughtUp: () =>
      h.div(
        [h.Class('grid grid-cols-[auto_1fr] items-center gap-3')],
        [
          h.span([h.Role('status'), h.Class('px-1 text-sm text-muted-foreground')], ['Caught up']),
          resetForm(h, slug, 'Start over', primaryButton),
        ],
      ),
    Unavailable: () =>
      checking
        ? h.span(
            [
              h.Role('status'),
              h.AriaLabel('Checking unread'),
              h.Class(`${primaryButton} opacity-50`),
            ],
            ['Next unread'],
          )
        : h.div(
            [h.Class('grid grid-cols-[1fr_auto] items-center gap-3')],
            [
              h.span(
                [h.Role('status'), h.Class('px-1 text-sm text-muted-foreground')],
                ['Unread navigation unavailable'],
              ),
              failed
                ? h.button(
                    [
                      h.Type('button'),
                      h.OnClick(
                        Message.GotTweetReaderMessage({
                          message: Reader.Message.RetryNavigation(),
                        }),
                      ),
                      h.Class(secondaryButton),
                    ],
                    ['Retry navigation'],
                  )
                : h.empty,
            ],
          ),
  })

export const readerActions = (
  h: HtmlBuilder<Message>,
  input: {
    readonly slug: string
    readonly neighbours: MicroPostNeighboursResponse | null
    readonly checking: boolean
    readonly failed: boolean
  },
) => {
  const target = Reader.nextUnread(input.neighbours)
  const caughtUp = Reader.UnreadTarget.$is('CaughtUp')(target)

  return h.div(
    [h.Class('space-y-2')],
    [
      nextUnread(h, input.slug, target, input.checking, input.failed),
      h.div(
        [h.Class('grid grid-cols-2 gap-2')],
        [
          h.a(
            [h.Href('/tweet/latest'), h.Class(secondaryButton)],
            [lucide(iconPaths.skipBack, 'h-4 w-4'), 'Latest'],
          ),
          h.form(
            [h.Method('post'), h.Action('/actions/tweet-random'), h.Class('m-0')],
            [
              h.input([h.Type('hidden'), h.Name('slug'), h.Value(input.slug)]),
              h.button(
                [
                  h.Type('submit'),
                  h.AriaLabel('Random unread'),
                  h.Disabled(caughtUp),
                  h.Class(`${secondaryButton} w-full cursor-pointer`),
                ],
                [
                  lucide(iconPaths.shuffle, 'h-4 w-4'),
                  'Random',
                  h.span([h.Class('hidden sm:inline')], [' unread']),
                ],
              ),
            ],
          ),
        ],
      ),
      caughtUp
        ? h.empty
        : h.details(
            [h.Class('group pt-1')],
            [
              h.summary(
                [
                  h.Class(
                    'cursor-pointer list-none py-1 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden',
                  ),
                ],
                ['Reset reading history…'],
              ),
              h.div(
                [
                  h.Class(
                    'mt-2 grid grid-cols-[1fr_auto] items-center gap-3 rounded-sm border border-border p-3',
                  ),
                ],
                [
                  h.p(
                    [h.Class('m-0 text-xs text-muted-foreground')],
                    ['Mark every tweet as unread again and start from the latest.'],
                  ),
                  resetForm(
                    h,
                    input.slug,
                    'Reset',
                    `${baseButton} border-destructive bg-destructive/25 text-foreground hover:bg-destructive/40`,
                  ),
                ],
              ),
            ],
          ),
    ],
  )
}
