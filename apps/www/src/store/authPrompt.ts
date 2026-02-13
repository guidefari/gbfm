import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

type ContentType = 'mix' | 'show'

interface AuthPromptState {
  isOpen: boolean
  contentType: ContentType
  onAuthSuccess: (() => void) | null
}

interface AuthPromptActions {
  open: (contentType: ContentType, onAuthSuccess: () => void) => void
  close: () => void
}

type AuthPromptStore = AuthPromptState & AuthPromptActions

export const useAuthPromptStore = create<AuthPromptStore>()(
  devtools(
    (set) => ({
      isOpen: false,
      contentType: 'mix',
      onAuthSuccess: null,

      open: (contentType, onAuthSuccess) =>
        set(
          { isOpen: true, contentType, onAuthSuccess },
          false,
          'authPrompt/open'
        ),

      close: () =>
        set({ isOpen: false, onAuthSuccess: null }, false, 'authPrompt/close')
    }),
    { name: 'AuthPromptStore' }
  )
)
