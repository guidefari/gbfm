import { expect, test } from 'vitest'
import { getFeatureFlags, isFeatureEnabled } from './index'

test('feature flags expose their defaults and resolve by name', () => {
  expect(getFeatureFlags()).toEqual({
    'ui.share': true,
    'ui.queue': false
  })
  expect(isFeatureEnabled('ui.share')).toBe(true)
  expect(isFeatureEnabled('ui.queue')).toBe(false)
})
