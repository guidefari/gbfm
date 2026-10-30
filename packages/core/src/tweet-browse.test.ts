import { expect, test } from 'vitest'

import { browseExcerpt, browseMonths, browsePage, browseWindow } from './tweet-browse'

const timeline = [
  { month: '2022-01', total: 2, unread: 1 },
  { month: '2026-09', total: 35, unread: 30 },
  { month: '2026-10', total: 4, unread: 2 },
]

test('browse dates are newest first without changing the API timeline', () => {
  expect(browseMonths(timeline).map((entry) => entry.month)).toEqual([
    '2026-10',
    '2026-09',
    '2022-01',
  ])
  expect(timeline[0]?.month).toBe('2022-01')
})

test('date filters use the same top-level chronological feed without changing the API', () => {
  expect(browseWindow(timeline, '2026-09', 0)).toEqual({
    month: '2026-09',
    page: 0,
    offset: 4,
    limit: 30,
    total: 35,
    hasMore: true,
  })
  expect(browseWindow(timeline, '2026-09', 1)).toEqual({
    month: '2026-09',
    page: 1,
    offset: 34,
    limit: 5,
    total: 35,
    hasMore: false,
  })
  expect(browseWindow(timeline, '2022-01', 0).offset).toBe(39)
})

test('invalid dates and page numbers fall back to a bounded available page', () => {
  expect(browseWindow(timeline, 'invalid', 0).month).toBeNull()
  expect(browseWindow(timeline, '2026-10', 99).page).toBe(0)
  expect(browseWindow([], null, 1)).toMatchObject({ page: 1, offset: 30, limit: 1, hasMore: false })

  for (const value of ['nope', '-1', '1.5', 'Infinity']) expect(browsePage(value)).toBe(0)
})

test('previews strip source markup rather than showing raw links or embed code', () => {
  expect(
    browseExcerpt({
      title: null,
      content: 'A **great** [record](https://example.test). <MusicEmbed />',
    }),
  ).toBe('A great record.')
  expect(browseExcerpt({ title: 'Short thought', content: 'Longer body' })).toBe('Short thought')
})
