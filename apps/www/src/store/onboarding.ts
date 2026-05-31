import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface OnboardingState {
  hasSeenWelcome: boolean
}

interface OnboardingActions {
  markWelcomeSeen: () => void
  reset: () => void
}

type OnboardingStore = OnboardingState & OnboardingActions

export const useOnboardingStore = create<OnboardingStore>()(
  devtools(
    persist(
      (set) => ({
        hasSeenWelcome: false,

        markWelcomeSeen: () => set({ hasSeenWelcome: true }, false, 'onboarding/welcomeSeen'),

        reset: () =>
          set(
            {
              hasSeenWelcome: false
            },
            false,
            'onboarding/reset'
          )
      }),
      {
        name: 'onboarding-store'
      }
    ),
    { name: 'OnboardingStore' }
  )
)
