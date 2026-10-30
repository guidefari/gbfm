export type BrowseMonth = {
  readonly month: string
  readonly total: number
  readonly unread: number
}

export const browseMonths = <A extends BrowseMonth>(months: ReadonlyArray<A>): ReadonlyArray<A> =>
  [...months].sort((left, right) => right.month.localeCompare(left.month))

export const browsePage = (value: string | number | null | undefined) => {
  const page = Number(value ?? 0)

  return Number.isSafeInteger(page) && page >= 0 ? Math.min(page, 10000) : 0
}

export const browseWindow = (
  timeline: ReadonlyArray<BrowseMonth>,
  month: string | null,
  page: number,
) => {
  const months = browseMonths(timeline)
  const selected = months.find((entry) => entry.month === month)
  const total = selected?.total ?? months.reduce((sum, entry) => sum + entry.total, 0)

  const current = months.length
    ? Math.min(browsePage(page), Math.max(0, Math.ceil(total / 30) - 1))
    : browsePage(page)

  const start = selected
    ? months.reduce((sum, entry) => sum + (entry.month > selected.month ? entry.total : 0), 0)
    : 0

  return {
    month: selected?.month ?? null,
    page: current,
    offset: start + current * 30,
    limit: Math.max(1, Math.min(30, total - current * 30)),
    total,
    hasMore: (current + 1) * 30 < total,
  }
}

export const browseMonthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })

export const browseExcerpt = (post: {
  readonly title: string | null
  readonly content: string | null
  readonly description?: string | null
}) => {
  const text = [post.title, post.description, post.content].find((value) => value?.trim()) ?? ''

  const clean = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return clean.length > 180 ? `${clean.slice(0, 180).trimEnd()}…` : clean
}
