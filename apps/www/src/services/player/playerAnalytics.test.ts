import { describe, expect, it } from 'vitest'
import { buildPausedProperties } from './playerAnalyticsHelpers'

describe('playerAnalyticsHelpers', () => {
  it('builds pause analytics for known and unknown durations', () => {
    expect(
      buildPausedProperties({
        trackId: 't1',
        title: 'Mix',
        currentTime: 30,
        duration: 100
      })
    ).toEqual({
      trackId: 't1',
      title: 'Mix',
      currentTime: 30,
      progressPercent: 30
    })
    expect(
      buildPausedProperties({
        trackId: null,
        title: 'Mix',
        currentTime: 12,
        duration: 0
      }).progressPercent
    ).toBe(0)
  })
})
