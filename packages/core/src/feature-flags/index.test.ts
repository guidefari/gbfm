import { describe, expect, test } from 'vitest'
import { getFeatureFlags, isFeatureEnabled } from './index'

describe('feature flags', () => {
  test('returns all flags with default values', () => {
    expect(getFeatureFlags()).toEqual({
      'ui.share': true,
      'ui.queue': false
    })
  })

  test('resolves share and queue flags', () => {
    expect(isFeatureEnabled('ui.share')).toBe(true)
    expect(isFeatureEnabled('ui.queue')).toBe(false)
  })
})
