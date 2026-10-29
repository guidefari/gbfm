export type SwipePoint = {
  readonly x: number
  readonly y: number
  readonly time: number
  readonly pointers: number
}

export type ReaderSwipe = {
  readonly origin: SwipePoint
  readonly axis: 'pending' | 'horizontal' | 'vertical'
  readonly maxVertical: number
}

const validPoint = (point: SwipePoint) =>
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  Number.isFinite(point.time) &&
  point.pointers === 1

export const beginReaderSwipe = (point: SwipePoint, viewportWidth: number): ReaderSwipe | null =>
  validPoint(point) &&
  Number.isFinite(viewportWidth) &&
  point.x > 32 &&
  point.x < viewportWidth - 32
    ? { origin: point, axis: 'pending', maxVertical: 0 }
    : null

export const moveReaderSwipe = (
  swipe: ReaderSwipe | null,
  point: SwipePoint,
): ReaderSwipe | null => {
  if (!swipe || !validPoint(point)) return null

  const horizontal = Math.abs(point.x - swipe.origin.x)
  const vertical = Math.abs(point.y - swipe.origin.y)
  const maxVertical = Math.max(swipe.maxVertical, vertical)

  if (swipe.axis !== 'pending') return { ...swipe, maxVertical }

  if (horizontal >= 12 && horizontal > vertical * 1.8)
    return { ...swipe, axis: 'horizontal', maxVertical }

  return { ...swipe, axis: vertical >= 12 ? 'vertical' : 'pending', maxVertical }
}

export const finishReaderSwipe = (
  swipe: ReaderSwipe | null,
  point: SwipePoint,
): 'older' | 'newer' | null => {
  const moved = moveReaderSwipe(swipe, point)

  if (!moved || moved.axis !== 'horizontal') return null

  const elapsed = point.time - moved.origin.time
  const dx = point.x - moved.origin.x
  const dy = point.y - moved.origin.y

  return elapsed >= 0 &&
    elapsed <= 700 &&
    Math.abs(dx) >= 64 &&
    moved.maxVertical <= 40 &&
    Math.abs(dx) > Math.abs(dy) * 1.8
    ? dx < 0
      ? 'older'
      : 'newer'
    : null
}
