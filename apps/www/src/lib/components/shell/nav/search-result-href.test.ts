import { describe, expect, it } from 'vitest'

import { searchResultHref } from './search-result-href'

const result = (type: string, showSlug?: string | null) => ({
  id: 'id-1',
  title: 'Title',
  slug: 'the-slug',
  type,
  thumbnailUrl: null,
  description: null,
  showSlug,
})

describe('searchResultHref', () => {
  it('links shows, tweets, editorial and mixes to their own pages', () => {
    expect(searchResultHref(result('show'))).toBe('/shows/the-slug')
    expect(searchResultHref(result('micro'))).toBe('/tweet/the-slug')
    expect(searchResultHref(result('post'))).toBe('/editorial/the-slug')
    expect(searchResultHref(result('mix'))).toBe('/mixes/the-slug')
  })

  it('falls back to the parent show for other audio', () => {
    expect(searchResultHref(result('misc', 'far-end-radio'))).toBe('/shows/far-end-radio')
  })

  it('returns null when there is nowhere to go', () => {
    expect(searchResultHref(result('misc', null))).toBe(null)
  })
})
