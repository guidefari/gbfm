import { describe, expect, it } from 'vitest'
import { buildPausedProperties } from './playerAnalyticsHelpers'

describe('playerAnalyticsHelpers', () => {
  it('computes progress percent for pause events', () => {
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
  })

  it('uses zero progress when duration is unknown', () => {
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
