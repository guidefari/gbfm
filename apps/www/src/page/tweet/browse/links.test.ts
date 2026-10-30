import { expect, test } from 'vitest'

import { concreteSlug, isEntry } from '../reader'
import { browseHref, isTweetBrowse } from './links'

test('browsing is not a reader entry and previews alone do not count as reading a tweet', () => {
  const href = browseHref('2026-09', 2)
  expect(isEntry(`https://goosebumps.fm${href}`)).toBe(false)
  expect(concreteSlug(href)).toBeNull()
  expect(isTweetBrowse(new URL(href, 'https://goosebumps.fm'))).toBe(true)
})

test('selected tweets preserve their date/page context and use normal reader ownership', () => {
  const href = browseHref('2026-09', 2, 'a tweet')
  expect(new URL(href, 'https://goosebumps.fm').searchParams.get('selected')).toBe('a tweet')
  expect(concreteSlug(browseHref('2026-09', 2, 'a-tweet'))).toBe('a-tweet')
  expect(concreteSlug('/tweets?q=archive&selected=../secret')).toBeNull()
  expect(concreteSlug('/tweets?q=archive&selected=latest')).toBeNull()
})
