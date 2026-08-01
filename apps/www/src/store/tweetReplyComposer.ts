import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'

type TweetReplyComposerState = {
  readonly isOpen: boolean
  readonly draft: string
  readonly musicUrl: string
  readonly quoteInput: string
}

const initialState: TweetReplyComposerState = {
  isOpen: false,
  draft: '',
  musicUrl: '',
  quoteInput: ''
}

export const tweetReplyComposerAtom = Atom.make<TweetReplyComposerState>(initialState).pipe(
  Atom.keepAlive
)

export const useTweetReplyComposer = () => useAtomValue(tweetReplyComposerAtom)

export const useTweetReplyComposerActions = () => {
  const set = useAtomSet(tweetReplyComposerAtom)

  return {
    open: () => set((state) => ({ ...state, isOpen: true })),
    setDraft: (draft: string) => set((state) => ({ ...state, draft })),
    setMusicUrl: (musicUrl: string) => set((state) => ({ ...state, musicUrl })),
    clearMusicUrl: () => set((state) => ({ ...state, musicUrl: '' })),
    setQuoteInput: (quoteInput: string) => set((state) => ({ ...state, quoteInput })),
    reset: () => set(() => initialState)
  }
}
