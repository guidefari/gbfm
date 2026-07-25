import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Schema } from 'effect'
import { persistedAtom } from './persistedAtom'

const OnboardingState = Schema.Struct({
  hasSeenWelcome: Schema.Boolean
})

export type OnboardingState = (typeof OnboardingState)['Type']

const { atom: onboardingAtom, write } = persistedAtom({
  key: 'gbfm-onboarding.json',
  schema: OnboardingState,
  fallback: { hasSeenWelcome: false }
})

export { onboardingAtom }

export const useHasSeenWelcome = () => useAtomValue(onboardingAtom, (state) => state.hasSeenWelcome)

export const useOnboardingActions = () => {
  const set = useAtomSet(onboardingAtom)

  const update = (value: OnboardingState) => {
    write(value)
    set(value)
  }

  return {
    markWelcomeSeen: () => update({ hasSeenWelcome: true }),
    reset: () => update({ hasSeenWelcome: false })
  }
}
