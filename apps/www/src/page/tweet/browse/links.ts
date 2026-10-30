export const browseHref = (
  month: string | null = null,
  page = 0,
  selected: string | null = null,
) => {
  const query = new URLSearchParams({ q: 'archive' })

  if (month) query.set('month', month)

  if (page) query.set('page', String(page))

  if (selected) query.set('selected', selected)

  return `/tweets?${query}`
}

export const isTweetBrowse = (url: URL) =>
  url.pathname === '/tweets' && url.searchParams.get('q') === 'archive'
