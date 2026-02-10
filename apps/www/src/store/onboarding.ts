import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface OnboardingState {
  hasSeenWelcome: boolean
  hasSeenSignUpPrompt: boolean
  hasDismissedSignUpPrompt: boolean
  signUpPromptDismissedAt: number | null
}

interface OnboardingActions {
  markWelcomeSeen: () => void
  markSignUpPromptSeen: () => void
  dismissSignUpPrompt: () => void
  shouldShowSignUpPrompt: () => boolean
  reset: () => void
}

type OnboardingStore = OnboardingState & OnboardingActions

const SESSION_DISMISS_DURATION = 1000 * 60 * 60 // 1 hour

export const useOnboardingStore = create<OnboardingStore>()(
  devtools(
    persist(
      (set, get) => ({
        hasSeenWelcome: false,
        hasSeenSignUpPrompt: false,
        hasDismissedSignUpPrompt: false,
        signUpPromptDismissedAt: null,

        markWelcomeSeen: () =>
          set({ hasSeenWelcome: true }, false, 'onboarding/welcomeSeen'),

        markSignUpPromptSeen: () =>
          set(
            { hasSeenSignUpPrompt: true },
            false,
            'onboarding/signUpPromptSeen'
          ),

        dismissSignUpPrompt: () =>
          set(
            {
              hasDismissedSignUpPrompt: true,
              signUpPromptDismissedAt: Date.now()
            },
            false,
            'onboarding/dismissSignUpPrompt'
          ),

        shouldShowSignUpPrompt: () => {
          const state = get()
          if (!state.hasDismissedSignUpPrompt) return true

          const dismissedAt = state.signUpPromptDismissedAt
          if (!dismissedAt) return true

          return Date.now() - dismissedAt > SESSION_DISMISS_DURATION
        },

        reset: () =>
          set(
            {
              hasSeenWelcome: false,
              hasSeenSignUpPrompt: false,
              hasDismissedSignUpPrompt: false,
              signUpPromptDismissedAt: null
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
