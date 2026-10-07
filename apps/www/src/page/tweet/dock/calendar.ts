import { inertHtml as h } from 'foldkit/html'

import { monthLabel, type RailMonth } from '../timeline'

const monthInitials = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

const monthKey = (year: string, index: number) => `${year}-${String(index + 1).padStart(2, '0')}`

const cell = (key: string, month: RailMonth | undefined, busiest: number, current: string) => {
  if (!month?.newestSlug)
    return h.span([h.Key(key), h.AriaHidden(true), h.Class('h-7 rounded-sm bg-muted/25')], [])

  const label = monthLabel(key)
  const unread = Math.min(month.unread, month.total)

  return h.a(
    [
      h.Key(key),
      h.Href(`/tweet/${encodeURIComponent(month.newestSlug)}`),
      h.AriaLabel(`Jump to ${label}`),
      h.AriaCurrent(key === current ? 'date' : 'false'),
      h.Title(`${label}: ${month.total} tweets, ${unread} unread`),
      h.Class(
        'relative flex h-7 flex-col justify-end overflow-hidden rounded-sm bg-muted/40 transition-opacity hover:opacity-80 aria-[current=date]:outline aria-[current=date]:outline-2 aria-[current=date]:outline-offset-1 aria-[current=date]:outline-foreground',
      ),
    ],
    [
      h.span(
        [
          h.AriaHidden(true),
          h.Class('flex flex-col'),
          h.Style({ height: `${Math.max(Math.sqrt(month.total / busiest), 0.25) * 100}%` }),
        ],
        [
          h.span([h.Class('bg-highlight'), h.Style({ 'flex-grow': String(unread) })], []),
          h.span(
            [
              h.Class('bg-muted-foreground/50'),
              h.Style({ 'flex-grow': String(month.total - unread) }),
            ],
            [],
          ),
        ],
      ),
    ],
  )
}

/** Years down, months across: the whole archive at a glance, newest year first. */
export const calendar = (months: ReadonlyArray<RailMonth>, current: string) => {
  const byMonth = new Map(months.map((month) => [month.month, month]))
  const years = [...new Set(months.map((month) => month.month.slice(0, 4)))]
  const busiest = Math.max(1, ...months.map((month) => month.total))

  return h.nav(
    [
      h.AriaLabel('Tweets per month'),
      h.Class(
        'grid grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground',
      ),
    ],
    [
      h.span([h.Key('corner')], []),
      ...monthInitials.map((initial, index) =>
        h.span([h.Key(`m${index}`), h.AriaHidden(true), h.Class('text-center')], [initial]),
      ),
      ...years.flatMap((year) => [
        h.span([h.Key(year), h.Class('pr-2 text-right leading-7')], [year]),
        ...monthInitials.map((_, index) => {
          const key = monthKey(year, index)

          return cell(key, byMonth.get(key), busiest, current)
        }),
      ]),
    ],
  )
}
