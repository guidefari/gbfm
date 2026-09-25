import type { MicroPostTimelineMonth } from '@gbfm/api/navigation'

export type RailMonth = Omit<MicroPostTimelineMonth, 'newestSlug'> & {
  readonly newestSlug: string | null
}

const monthKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`

const parseMonth = (month: string) => {
  const [year = 0, monthNumber = 1] = month.split('-').map(Number)

  return { year, monthIndex: monthNumber - 1 }
}

/** Fills gaps so every calendar month between the oldest and newest tweet is present, newest first. */
export const timelineMonths = (timeline: ReadonlyArray<RailMonth>): ReadonlyArray<RailMonth> => {
  const first = timeline[0]
  const last = timeline.at(-1)

  if (!first || !last) return []
  const byMonth = new Map(timeline.map((entry) => [entry.month, entry]))
  const start = parseMonth(first.month)
  const end = parseMonth(last.month)
  const months: Array<RailMonth> = []

  for (
    let cursor = end.year * 12 + end.monthIndex;
    cursor >= start.year * 12 + start.monthIndex;
    cursor -= 1
  ) {
    const month = monthKey(Math.floor(cursor / 12), cursor % 12)
    months.push(byMonth.get(month) ?? { month, total: 0, unread: 0, newestSlug: null })
  }

  return months
}

/** Horizontal position of a timestamp on a newest-first month rail, as a percentage. */
export const markerPercent = (months: ReadonlyArray<RailMonth>, at: string) => {
  if (!months.length) return 0
  const date = new Date(at)

  const index = months.findIndex(
    (entry) => entry.month === monthKey(date.getUTCFullYear(), date.getUTCMonth()),
  )

  if (index < 0) return 0

  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate()

  const throughMonth = (date.getUTCDate() - 0.5) / daysInMonth

  return ((index + 1 - throughMonth) / months.length) * 100
}

export const monthLabel = (month: string) => {
  const { year, monthIndex } = parseMonth(month)

  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const DAY_MS = 24 * 60 * 60 * 1000

/** A loose sense of age: "today", "3 days ago", "2 months ago", "a year ago". */
export const relativeAge = (at: string, now: number) => {
  const days = Math.floor((now - new Date(at).getTime()) / DAY_MS)
  const format = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })

  if (days < 1) return 'today'

  if (days < 30) return format.format(-days, 'day')

  if (days < 365) return format.format(-Math.floor(days / 30), 'month')

  return format.format(-Math.floor(days / 365), 'year')
}

/** Groups newest-first months under their year, newest year first. */
export const yearGroups = (months: ReadonlyArray<RailMonth>) => {
  const groups: Array<{ year: string; months: Array<RailMonth> }> = []

  for (const entry of months) {
    const year = entry.month.slice(0, 4)
    const group = groups.at(-1)

    if (group?.year === year) group.months.push(entry)
    else groups.push({ year, months: [entry] })
  }

  return groups
}

export const monthOf = (at: string) => {
  const date = new Date(at)

  return monthKey(date.getUTCFullYear(), date.getUTCMonth())
}
