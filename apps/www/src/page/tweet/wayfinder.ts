import type { MicroPostNeighboursResponse } from '@gbfm/api/navigation'
import { inertHtml as h } from 'foldkit/html'

import { breadcrumbs, crumbLink } from '../../view/breadcrumbs'
import { iconPaths, lucide } from '../../view/icons'
import {
  markerPercent,
  monthLabel,
  monthOf,
  relativeAge,
  timelineMonths,
  yearJumps,
} from './timeline'

interface Jump {
  readonly label: string
  readonly slug: string | null
  readonly current: boolean
  readonly total: number
  readonly unread: number
}

const jumpMenu = (label: string, title: string, items: ReadonlyArray<Jump>) =>
  h.details(
    [h.Class('tweet-jump'), h.Name('tweet-jumps')],
    [
      h.summary(
        [
          h.AriaLabel(title),
          h.Class(
            'flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground',
          ),
        ],
        [label, lucide(iconPaths.chevronDown, 'h-3.5 w-3.5')],
      ),
      h.nav(
        [h.Class('tweet-jump-options'), h.AriaLabel(title)],
        items.map((item) =>
          item.slug
            ? h.a(
                [
                  h.Href(`/tweet/${encodeURIComponent(item.slug)}`),
                  h.AriaCurrent(item.current ? 'date' : 'false'),
                ],
                [
                  h.span([], [item.label]),
                  item.unread > 0 && item.unread < item.total
                    ? h.small([], [`${item.unread} new`])
                    : h.empty,
                  h.span([], [String(item.total)]),
                ],
              )
            : h.span([h.Class('empty-month')], [item.label, ' 0']),
        ),
      ),
    ],
  )

/** Native disclosures keep year/month navigation usable before hydration and without JavaScript. */
export const tweetWayfinder = (
  neighbours: MicroPostNeighboursResponse | null,
  at: string,
  now: number,
) => {
  const months = timelineMonths(neighbours?.timeline ?? [])
  const currentMonth = monthOf(at)
  const currentYear = currentMonth.slice(0, 4)
  const busiest = Math.max(1, ...months.map((month) => month.total))

  return h.div(
    [h.Class('tweet-wayfinder'), h.Key(at)],
    [
      h.div(
        [h.Class('tweet-breadcrumb')],
        [
          breadcrumbs([
            crumbLink({ label: 'Tweets', href: '/tweets' }),
            jumpMenu(
              currentYear,
              'Jump to year',
              yearJumps(months).map((year) => ({
                label: year.year,
                slug: year.newestSlug,
                current: year.year === currentYear,
                total: year.total,
                unread: year.unread,
              })),
            ),
            jumpMenu(
              monthLabel(currentMonth).slice(0, 3),
              `Jump within ${currentYear}`,
              months
                .filter((month) => month.month.startsWith(currentYear))
                .map((month) => ({
                  label: monthLabel(month.month).slice(0, 3),
                  slug: month.newestSlug,
                  current: month.month === currentMonth,
                  total: month.total,
                  unread: month.unread,
                })),
            ),
          ]),
          h.span([h.Class('tweet-age')], [relativeAge(at, now)]),
          neighbours?.unreadCount
            ? h.span([h.Class('tweet-unread')], [`${neighbours.unreadCount} new`])
            : h.empty,
        ],
      ),
      h.figure(
        [h.Class('tweet-month-rail'), h.AriaLabel('Tweets per month')],
        [
          ...months.map((month) =>
            month.newestSlug
              ? h.a(
                  [
                    h.Href(`/tweet/${encodeURIComponent(month.newestSlug)}`),
                    h.Title(monthLabel(month.month)),
                    h.AriaLabel(`Jump to ${monthLabel(month.month)}`),
                    h.Style({ height: `${Math.max(month.total / busiest, 0.12) * 100}%` }),
                  ],
                  [
                    h.span([h.Class('unread'), h.Style({ 'flex-grow': String(month.unread) })], []),
                    h.span(
                      [
                        h.Class('read'),
                        h.Style({ 'flex-grow': String(month.total - month.unread) }),
                      ],
                      [],
                    ),
                  ],
                )
              : h.span([h.Class('empty-month')], []),
          ),
          months.length
            ? h.span(
                [
                  h.Class('tweet-month-marker'),
                  h.AriaHidden(true),
                  h.Style({ left: `${markerPercent(months, at)}%` }),
                ],
                [],
              )
            : h.empty,
        ],
      ),
    ],
  )
}
