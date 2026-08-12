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

describe('player decisions', () => {
  test('maps playback controls to safe progress, seek, and volume values', () => {
    expect(resolveProgress(30, 120)).toBe(25)
    expect(resolveProgress(30, 0)).toBe(0)
    expect(resolveProgress(30, Number.NaN)).toBe(0)

    expect(resolveSeekTarget(50, 200)).toBe(100)
    expect(resolveSeekTarget(-10, 200)).toBe(0)
    expect(resolveSeekTarget(140, 200)).toBe(200)
    expect(resolveSeekTarget(50, 0)).toBe(0)

    expect(resolveRelativeSeek(60, 30, 300)).toBe(90)
    expect(resolveRelativeSeek(60, -15, 300)).toBe(45)
    expect(resolveRelativeSeek(5, -15, 300)).toBe(0)
    expect(resolveRelativeSeek(290, 30, 300)).toBe(300)
    expect(resolveRelativeSeek(10, 30, 0)).toBe(40)

    expect(resolveVolume(50, false)).toBe(0.5)
    expect(resolveVolume(80, true)).toBe(0)
    expect(resolveVolume(150, false)).toBe(1)
    expect(resolveVolume(-20, false)).toBe(0)
  })

  test('navigates the queue at its beginning, middle, end, and empty states', () => {
    expect(resolveNextIndex({ trackCount: 3, currentIndex: 0 })).toBe(1)
    expect(resolveNextIndex({ trackCount: 3, currentIndex: 2 })).toBeNull()
    expect(resolveNextIndex({ trackCount: 0, currentIndex: -1 })).toBeNull()

    expect(resolvePreviousIndex({ trackCount: 3, currentIndex: 2 })).toBe(1)
    expect(resolvePreviousIndex({ trackCount: 3, currentIndex: 0 })).toBe(2)
    expect(resolvePreviousIndex({ trackCount: 3, currentIndex: -1 })).toBeNull()
    expect(resolvePreviousIndex({ trackCount: 0, currentIndex: -1 })).toBeNull()
  })

  test('loads, restores, resumes, or skips a track according to playback state', () => {
    expect(
      resolveTrackLoad({
        loadedTrackId: 'a',
        nextTrackId: 'b',
        autoplay: true,
        savedPosition: 42
      })
    ).toEqual({ _tag: 'load', restoreFrom: 42 })
    expect(
      resolveTrackLoad({
        loadedTrackId: null,
        nextTrackId: 'b',
        autoplay: true,
        savedPosition: null
      })
    ).toEqual({ _tag: 'load', restoreFrom: null })
    expect(
      resolveTrackLoad({
        loadedTrackId: null,
        nextTrackId: 'b',
        autoplay: false,
        savedPosition: 0
      })
    ).toEqual({ _tag: 'load', restoreFrom: null })
    expect(
      resolveTrackLoad({
        loadedTrackId: 'a',
        nextTrackId: 'a',
        autoplay: true,
        savedPosition: 10
      })
    ).toEqual({ _tag: 'resume' })
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
