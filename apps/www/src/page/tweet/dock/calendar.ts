import { inertHtml as h } from 'foldkit/html'

import { monthLabel, type RailMonth } from '../timeline'

const cell = (month: RailMonth, current: string) => {
  if (!month.newestSlug) return h.empty

  const label = monthLabel(month.month)
  const unread = Math.min(month.unread, month.total)

  return h.a(
    [
      h.Key(month.month),
      h.Href(`/tweet/${encodeURIComponent(month.newestSlug)}`),
      h.AriaLabel(`Jump to ${label}`),
      h.AriaCurrent(month.month === current ? 'date' : 'false'),
      h.Title(`${label}: ${month.total} tweets, ${unread} unread`),
      h.Class('btn tweet-month'),
    ],
    [`${label} · ${unread}/${month.total}`],
  )
}

export const calendar = (months: ReadonlyArray<RailMonth>, current: string) => {
  return h.nav(
    [h.AriaLabel('Tweets per month'), h.Class('grid grid-cols-2 gap-2')],
    months.flatMap((month) => (month.newestSlug ? [cell(month, current)] : [])),
  )
}
