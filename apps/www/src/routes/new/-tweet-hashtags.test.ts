import { describe, expect, it } from 'vitest'
import {
  activeFragment,
  appendHashtag,
  completeFragment,
  extractHashtags,
  removeHashtag,
  stripHashtags,
  suggestHashtags,
  toTagToken
} from './-tweet-hashtags'

describe('extractHashtags', () => {
  it('collects lowercased tags across fields, deduped in order', () => {
    expect(extractHashtags('love this #Ambient #idm', 'more #ambient #Deep-House')).toEqual([
      'ambient',
      'idm',
      'deep-house'
    ])
  })

  it('returns empty when there are no hashtags', () => {
    expect(extractHashtags('just a plain quip', '')).toEqual([])
  })

  it('keeps ampersands and hyphens inside tags', () => {
    expect(extractHashtags('#r&b #new-release')).toEqual(['r&b', 'new-release'])
  })
})

describe('stripHashtags', () => {
  it('removes hashtags and collapses the resulting whitespace', () => {
    expect(stripHashtags('this one #ambient never gets old #idm')).toBe('this one never gets old')
  })

  it('leaves plain text untouched', () => {
    expect(stripHashtags('no tags here')).toBe('no tags here')
  })

  it('does not treat a bare hash mid-word as a tag boundary error', () => {
    expect(stripHashtags('great #house set')).toBe('great set')
  })
})

describe('activeFragment', () => {
  it('detects an in-progress hashtag at the caret', () => {
    const text = 'digging this #amb'
    expect(activeFragment(text, text.length)).toEqual({ query: 'amb', start: 13 })
  })

  it('detects a hashtag started at the very beginning', () => {
    expect(activeFragment('#te', 3)).toEqual({ query: 'te', start: 0 })
  })

  it('returns null when the caret is not inside a hashtag', () => {
    expect(activeFragment('done #ambient here', 18)).toBeNull()
  })

  it('returns an empty query for a lone hash', () => {
    expect(activeFragment('start #', 7)).toEqual({ query: '', start: 6 })
  })
})

describe('suggestHashtags', () => {
  const known = ['ambient', 'amapiano', 'deep house', 'idm']

  it('matches known tags by prefix and appends the query as a new tag', () => {
    expect(suggestHashtags('am', known, [])).toEqual([
      { label: 'ambient', isNew: false },
      { label: 'amapiano', isNew: false },
      { label: 'am', isNew: true }
    ])
  })

  it('excludes already selected tags', () => {
    expect(suggestHashtags('ambient', known, ['ambient'])).toEqual([])
  })

  it('offers a new tag when the query matches nothing known', () => {
    expect(suggestHashtags('gqom', known, [])).toEqual([{ label: 'gqom', isNew: true }])
  })

  it('shows top known tags for a lone hash with no query', () => {
    expect(suggestHashtags('', known, [])).toEqual([
      { label: 'ambient', isNew: false },
      { label: 'amapiano', isNew: false },
      { label: 'deep-house', isNew: false },
      { label: 'idm', isNew: false }
    ])
  })
})

describe('completeFragment', () => {
  it('replaces the fragment with the chosen tag and a trailing space', () => {
    const text = 'digging this #amb'
    const fragment = { query: 'amb', start: 13 }
    expect(completeFragment(text, fragment, 'ambient')).toBe('digging this #ambient ')
  })
})

describe('appendHashtag', () => {
  it('adds a hashtag with a separating space after existing text', () => {
    expect(appendHashtag('this rules', 'ambient')).toBe('this rules #ambient ')
  })

  it('does not add a leading space when the field is empty', () => {
    expect(appendHashtag('', 'idm')).toBe('#idm ')
  })

  it('normalizes trailing whitespace before appending', () => {
    expect(appendHashtag('this rules   ', 'ambient')).toBe('this rules #ambient ')
  })
})

describe('removeHashtag', () => {
  it('removes the tag while keeping surrounding words', () => {
    expect(removeHashtag('this one #ambient never gets old', 'ambient')).toBe(
      'this one never gets old'
    )
  })

  it('does not remove a longer tag that starts with the target', () => {
    expect(removeHashtag('mix of #deep and #deep-house', 'deep')).toBe('mix of and #deep-house')
  })

  it('is case insensitive', () => {
    expect(removeHashtag('loud #IDM night', 'idm')).toBe('loud night')
  })
})

describe('toTagToken', () => {
  it('hyphenates whitespace and lowercases', () => {
    expect(toTagToken('Deep House')).toBe('deep-house')
  })
})
