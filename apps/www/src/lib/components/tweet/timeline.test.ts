import { expect, test } from 'vitest'

import { markerPercent, monthLabel, relativeAge, timelineMonths } from './timeline'

test('fills empty months between the oldest and newest tweet, newest first', () => {
  const months = timelineMonths([
    { month: '2025-11', total: 2, unread: 1, newestSlug: 't-2025-11' },
    { month: '2026-02', total: 5, unread: 0, newestSlug: 't-2026-02' },
  ])

  expect(months).toEqual([
    { month: '2026-02', total: 5, unread: 0, newestSlug: 't-2026-02' },
    { month: '2026-01', total: 0, unread: 0, newestSlug: null },
    { month: '2025-12', total: 0, unread: 0, newestSlug: null },
    { month: '2025-11', total: 2, unread: 1, newestSlug: 't-2025-11' },
  ])
})

test('places a tweet inside its month on the newest-first rail', () => {
  const months = timelineMonths([
    { month: '2026-01', total: 1, unread: 1, newestSlug: 't-2026-01' },
    { month: '2026-02', total: 1, unread: 1, newestSlug: 't-2026-02' },
  ])

  expect(markerPercent(months, '2026-02-28T12:00:00.000Z')).toBeCloseTo(0.89, 1)
  expect(markerPercent(months, '2026-01-01T12:00:00.000Z')).toBeCloseTo(99.19, 1)
  expect(markerPercent(months, '2020-01-01T00:00:00.000Z')).toBe(0)
})

test('describes months and ages loosely', () => {
  const now = Date.parse('2026-09-25T12:00:00.000Z')

  expect(monthLabel('2024-03')).toBe('Mar 2024')
  expect(relativeAge('2026-09-25T08:00:00.000Z', now)).toBe('today')
  expect(relativeAge('2026-09-20T08:00:00.000Z', now)).toBe('5 days ago')
  expect(relativeAge('2026-06-01T08:00:00.000Z', now)).toBe('3 months ago')
  expect(relativeAge('2024-09-01T08:00:00.000Z', now)).toBe('2 years ago')
})
