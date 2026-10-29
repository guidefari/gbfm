import { expect, test } from 'vitest'

import {
  beginReaderSwipe,
  finishReaderSwipe,
  moveReaderSwipe,
  type SwipePoint,
} from './reader-swipe'

const start: SwipePoint = { x: 190, y: 200, time: 0, pointers: 1 }

test('left opens older and right opens newer with a deliberate horizontal swipe', () => {
  const swipe = beginReaderSwipe(start, 390)

  expect(finishReaderSwipe(swipe, { ...start, x: 90, time: 250 })).toBe('older')
  expect(finishReaderSwipe(swipe, { ...start, x: 300, time: 250 })).toBe('newer')
})

test.each([0, 16, 32, 358, 374, 390])('preserves OS edge navigation at x=%s', (x) => {
  expect(beginReaderSwipe({ ...start, x }, 390)).toBeNull()
})

test('taps, short drags, long presses, vertical scroll and diagonal gestures do not navigate', () => {
  const swipe = beginReaderSwipe(start, 390)

  for (const point of [
    { ...start, time: 100 },
    { ...start, x: 150, time: 100 },
    { ...start, x: 80, time: 900 },
    { ...start, y: 400, time: 200 },
    { ...start, x: 100, y: 270, time: 200 },
    { ...start, x: 100, time: -1 },
  ])
    expect(finishReaderSwipe(swipe, point)).toBeNull()
})

test('a gesture that starts as a vertical scroll never turns into navigation', () => {
  const swipe = moveReaderSwipe(beginReaderSwipe(start, 390), { ...start, y: 220, time: 50 })

  expect(finishReaderSwipe(swipe, { ...start, x: 80, time: 200 })).toBeNull()
})

test('a large vertical excursion stays rejected even if the finger returns to the original row', () => {
  let swipe = moveReaderSwipe(beginReaderSwipe(start, 390), { ...start, x: 160, time: 50 })
  swipe = moveReaderSwipe(swipe, { ...start, x: 100, y: 260, time: 100 })

  expect(finishReaderSwipe(swipe, { ...start, x: 80, time: 200 })).toBeNull()
})

test('pinch and multi-touch cancel rather than navigating on the remaining finger', () => {
  const swipe = moveReaderSwipe(beginReaderSwipe(start, 390), { ...start, pointers: 2 })

  expect(swipe).toBeNull()
  expect(finishReaderSwipe(swipe, { ...start, x: 80, time: 200 })).toBeNull()
  expect(beginReaderSwipe({ ...start, pointers: 2 }, 390)).toBeNull()
})

test('invalid platform coordinates are rejected', () => {
  expect(beginReaderSwipe({ ...start, x: NaN }, 390)).toBeNull()
  expect(beginReaderSwipe(start, Infinity)).toBeNull()
  expect(finishReaderSwipe(beginReaderSwipe(start, 390), { ...start, time: NaN })).toBeNull()
})
