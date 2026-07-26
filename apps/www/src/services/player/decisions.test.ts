import { describe, expect, test } from 'vitest'
import {
  resolveNextIndex,
  resolvePreviousIndex,
  resolveProgress,
  resolveRelativeSeek,
  resolveSeekTarget,
  resolveTrackLoad,
  resolveVolume
} from './decisions'

describe('resolveProgress', () => {
  test('returns a percentage of the duration', () => {
    expect(resolveProgress(30, 120)).toBe(25)
  })

  test('returns zero when the duration is unknown', () => {
    expect(resolveProgress(30, 0)).toBe(0)
    expect(resolveProgress(30, Number.NaN)).toBe(0)
  })
})

describe('resolveSeekTarget', () => {
  test('converts a percentage into seconds', () => {
    expect(resolveSeekTarget(50, 200)).toBe(100)
  })

  test('clamps out-of-range percentages', () => {
    expect(resolveSeekTarget(-10, 200)).toBe(0)
    expect(resolveSeekTarget(140, 200)).toBe(200)
  })

  test('returns zero when the duration is not loaded', () => {
    expect(resolveSeekTarget(50, 0)).toBe(0)
  })
})

describe('resolveRelativeSeek', () => {
  test('moves forward and backward from the current time', () => {
    expect(resolveRelativeSeek(60, 30, 300)).toBe(90)
    expect(resolveRelativeSeek(60, -15, 300)).toBe(45)
  })

  test('never seeks before the start', () => {
    expect(resolveRelativeSeek(5, -15, 300)).toBe(0)
  })

  test('never seeks past the end', () => {
    expect(resolveRelativeSeek(290, 30, 300)).toBe(300)
  })

  test('allows overshoot when the duration is unknown', () => {
    expect(resolveRelativeSeek(10, 30, 0)).toBe(40)
  })
})

describe('resolveVolume', () => {
  test('maps percentage to the element scale', () => {
    expect(resolveVolume(50, false)).toBe(0.5)
  })

  test('returns silence when muted', () => {
    expect(resolveVolume(80, true)).toBe(0)
  })

  test('clamps out-of-range volumes', () => {
    expect(resolveVolume(150, false)).toBe(1)
    expect(resolveVolume(-20, false)).toBe(0)
  })
})

describe('queue navigation', () => {
  test('advances to the next track', () => {
    expect(resolveNextIndex({ trackCount: 3, currentIndex: 0 })).toBe(1)
  })

  test('stops at the end of the queue', () => {
    expect(resolveNextIndex({ trackCount: 3, currentIndex: 2 })).toBeNull()
  })

  test('has nothing to advance to on an empty queue', () => {
    expect(resolveNextIndex({ trackCount: 0, currentIndex: -1 })).toBeNull()
  })

  test('steps back through the queue', () => {
    expect(resolvePreviousIndex({ trackCount: 3, currentIndex: 2 })).toBe(1)
  })

  test('wraps to the end from the first track', () => {
    expect(resolvePreviousIndex({ trackCount: 3, currentIndex: 0 })).toBe(2)
  })

  test('has nothing to step back to when nothing is selected', () => {
    expect(resolvePreviousIndex({ trackCount: 3, currentIndex: -1 })).toBeNull()
    expect(resolvePreviousIndex({ trackCount: 0, currentIndex: -1 })).toBeNull()
  })
})

describe('resolveTrackLoad', () => {
  test('loads a new track and restores its saved position', () => {
    expect(
      resolveTrackLoad({
        loadedTrackId: 'a',
        nextTrackId: 'b',
        autoplay: true,
        savedPosition: 42
      })
    ).toEqual({ _tag: 'load', restoreFrom: 42 })
  })

  test('starts from the beginning when there is no saved position', () => {
    expect(
      resolveTrackLoad({
        loadedTrackId: null,
        nextTrackId: 'b',
        autoplay: true,
        savedPosition: null
      })
    ).toEqual({ _tag: 'load', restoreFrom: null })
  })

  test('ignores a zero saved position', () => {
    expect(
      resolveTrackLoad({
        loadedTrackId: null,
        nextTrackId: 'b',
        autoplay: false,
        savedPosition: 0
      })
    ).toEqual({ _tag: 'load', restoreFrom: null })
  })

  test('resumes rather than reloading the track already loaded', () => {
    expect(
      resolveTrackLoad({
        loadedTrackId: 'a',
        nextTrackId: 'a',
        autoplay: true,
        savedPosition: 10
      })
    ).toEqual({ _tag: 'resume' })
  })

  test('does nothing when the same track is selected without autoplay', () => {
    expect(
      resolveTrackLoad({
        loadedTrackId: 'a',
        nextTrackId: 'a',
        autoplay: false,
        savedPosition: 10
      })
    ).toEqual({ _tag: 'skip' })
  })
})
