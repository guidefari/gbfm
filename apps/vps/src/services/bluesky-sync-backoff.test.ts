import { describe, expect, test } from 'vitest'
import { MAX_CONSECUTIVE_FAILURES, nextScheduleAfterFailure } from './bluesky-sync.service'

const now = new Date('2026-01-01T00:00:00.000Z')

describe('nextScheduleAfterFailure', () => {
  test('backs off exponentially while retries remain', () => {
    expect(nextScheduleAfterFailure(0, now)).toEqual({
      consecutiveFailures: 1,
      scheduled: true,
      nextEligibleAt: new Date('2026-01-01T00:02:00.000Z')
    })
    expect(nextScheduleAfterFailure(1, now)).toEqual({
      consecutiveFailures: 2,
      scheduled: true,
      nextEligibleAt: new Date('2026-01-01T00:04:00.000Z')
    })
    expect(nextScheduleAfterFailure(3, now)).toEqual({
      consecutiveFailures: 4,
      scheduled: true,
      nextEligibleAt: new Date('2026-01-01T00:16:00.000Z')
    })
  })

  test('disables scheduling once the failure ceiling is reached', () => {
    expect(nextScheduleAfterFailure(MAX_CONSECUTIVE_FAILURES - 1, now)).toEqual({
      consecutiveFailures: MAX_CONSECUTIVE_FAILURES,
      scheduled: false,
      nextEligibleAt: null
    })
  })
})
