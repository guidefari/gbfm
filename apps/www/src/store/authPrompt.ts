import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'

type ContentType = 'mix' | 'show'

type AuthPromptState = {
  readonly isOpen: boolean
  readonly contentType: ContentType
  readonly onAuthSuccess: (() => void) | null
}

const initialState: AuthPromptState = {
  isOpen: false,
  contentType: 'mix',
  onAuthSuccess: null
}

export const authPromptAtom = Atom.make<AuthPromptState>(initialState).pipe(Atom.keepAlive)

export const useAuthPrompt = () => useAtomValue(authPromptAtom)

export const useAuthPromptActions = () => {
  const set = useAtomSet(authPromptAtom)

  return {
    open: (contentType: ContentType, onAuthSuccess: () => void) =>
      set({ isOpen: true, contentType, onAuthSuccess }),
    close: () => set((state) => ({ ...state, isOpen: false, onAuthSuccess: null }))
  }
}
