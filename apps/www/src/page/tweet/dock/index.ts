import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../../../message'
import { iconPaths, lucide } from '../../../view/icons'
import { monthLabel, monthOf, timelineMonths } from '../timeline'
import { readerActions } from './actions'
import { calendar } from './calendar'

const arrowClass =
  'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 text-sm text-muted-foreground no-underline transition-colors hover:bg-muted/60 hover:text-foreground'

const arrow = (
  h: HtmlBuilder<Message>,
  direction: 'newer' | 'older',
  slug: string | null | undefined,
) => {
  const label = direction === 'newer' ? 'Newer' : 'Older'

  const content =
    direction === 'newer'
      ? [lucide(iconPaths.chevronLeft, 'h-4 w-4'), h.span([h.Class('hidden sm:inline')], [label])]
      : [h.span([h.Class('hidden sm:inline')], [label]), lucide(iconPaths.chevronRight, 'h-4 w-4')]

  if (!slug)
    return h.span(
      [h.AriaHidden(true), h.Class(`${arrowClass} pointer-events-none opacity-30`)],
      content,
    )

  return h.a(
    [
      h.Id(`tweet-${direction}`),
      h.Href(`/tweet/${encodeURIComponent(slug)}`),
      h.AriaLabel(`${label} tweet`),
      h.Class(arrowClass),
    ],
    content,
  )
}

const unreadSummary = (
  h: HtmlBuilder<Message>,
  count: number | null,
  checking: boolean,
  stale: boolean,
) => {
  if (count === null) return h.span([], [checking ? 'checking unread' : 'unread unavailable'])

  if (count === 0) return h.span([], ['caught up'])

  return h.span([h.Class(stale ? 'text-highlight/60' : 'text-highlight')], [`${count} unread`])
}

/** Fixed above the site's bottom nav; the page reserves matching space so it never hides content. */
export const readerDock = (
  h: HtmlBuilder<Message>,
  input: {
    readonly slug: string
    readonly at: string
    readonly newer: string | null | undefined
    readonly older: string | null | undefined
    readonly neighbours: MicroPostNeighboursResponse | null
    readonly timeline: MicroPostNeighboursResponse | null
    readonly checking: boolean
    readonly failed: boolean
  },
) => {
  const months = timelineMonths(input.timeline?.timeline ?? [])
  const current = monthOf(input.at)
  const total = months.reduce((sum, month) => sum + month.total, 0)
  const count = input.timeline?.unreadCount ?? null

  return h.div(
    [
      h.Class(
        'pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 lg:bottom-12',
      ),
    ],
    [
      h.div(
        [
          h.Class(
            'pointer-events-auto relative mx-auto flex max-w-[46rem] items-center rounded-sm border border-border bg-background/95 shadow-lg backdrop-blur',
          ),
        ],
        [
          arrow(h, 'newer', input.newer),
          h.details(
            [h.Key(input.slug), h.DataAttribute('tweet-dock', ''), h.Class('group min-w-0 flex-1')],
            [
              h.summary(
                [
                  h.AriaLabel('Reading options'),
                  h.Class(
                    'flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-sm px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 [&::-webkit-details-marker]:hidden',
                  ),
                ],
                [
                  h.span([h.Class('truncate text-foreground')], [monthLabel(current)]),
                  h.span([h.AriaHidden(true)], ['·']),
                  unreadSummary(h, count, input.checking, input.neighbours === null),
                  lucide(
                    iconPaths.chevronDown,
                    'h-3.5 w-3.5 shrink-0 rotate-180 transition-transform group-open:rotate-0',
                  ),
                ],
              ),
              h.div(
                [
                  h.Class(
                    'absolute inset-x-0 bottom-full mb-2 max-h-[min(70dvh,36rem)] space-y-4 overflow-y-auto rounded-sm border border-border bg-background p-4 shadow-xl',
                  ),
                ],
                [
                  h.div(
                    [
                      h.Class(
                        'flex items-baseline justify-between gap-3 text-xs text-muted-foreground',
                      ),
                    ],
                    [
                      h.span([h.Class('text-sm text-foreground')], [monthLabel(current)]),
                      count === null ? h.empty : h.span([], [`${count} of ${total} unread`]),
                    ],
                  ),
                  months.length ? calendar(months, current) : h.empty,
                  readerActions(h, {
                    slug: input.slug,
                    neighbours: input.neighbours,
                    checking: input.checking,
                    failed: input.failed,
                  }),
                ],
              ),
            ],
          ),
          arrow(h, 'older', input.older),
        ],
      ),
    ],
  )
}
