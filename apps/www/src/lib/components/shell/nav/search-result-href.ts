import type { SearchResultItem } from '@gbfm/api/search'

export const searchResultHref = (result: SearchResultItem): string | null => {
  const slug = encodeURIComponent(result.slug)
  if (result.type === 'show') return `/shows/${slug}`
  if (result.type === 'micro') return `/tweet/${slug}`
  if (result.type === 'post') return `/editorial/${slug}`
  if (result.type === 'mix') return `/mixes/${slug}`
  if (result.showSlug) return `/shows/${encodeURIComponent(result.showSlug)}`
  return null
}

const typeLabels = new Map([
  ['show', 'show'],
  ['mix', 'mix'],
  ['track', 'track'],
  ['misc', 'audio'],
  ['micro', 'tweet'],
  ['post', 'editorial']
])

export const searchResultLabel = (type: string) => typeLabels.get(type) ?? type
