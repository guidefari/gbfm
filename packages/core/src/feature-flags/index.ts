import { useMemo } from 'react'

export type FeatureFlagKey = 'ui.share' | 'ui.queue'

export type FeatureFlags = Record<FeatureFlagKey, boolean>

const LOCAL_FEATURE_FLAGS: FeatureFlags = Object.freeze({
  'ui.share': true,
  'ui.queue': false
})

export const getFeatureFlags = (): FeatureFlags => LOCAL_FEATURE_FLAGS

export const isFeatureEnabled = (flag: FeatureFlagKey): boolean => LOCAL_FEATURE_FLAGS[flag]

export const useFeatureFlags = (): FeatureFlags => useMemo(() => LOCAL_FEATURE_FLAGS, [])

export const useFeatureFlag = (flag: FeatureFlagKey): boolean => useFeatureFlags()[flag]
