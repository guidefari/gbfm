import { useAtomSet, useAtomValue } from '@effect/atom-react'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useMemo } from 'react'

type ComposerSlot = {
  readonly isOpen: boolean
  readonly draft: string
  readonly musicUrl: string
}

type TweetReplyComposerState = {
  readonly slots: Readonly<Record<string, ComposerSlot>>
}

const emptySlot: ComposerSlot = {
  isOpen: false,
  draft: '',
  musicUrl: ''
}

const initialState: TweetReplyComposerState = { slots: {} }

export const tweetReplyComposerAtom = Atom.make<TweetReplyComposerState>(initialState).pipe(
  Atom.keepAlive
)

export const useTweetReplyComposer = (slug: string): ComposerSlot => {
  const state = useAtomValue(tweetReplyComposerAtom)
  return state.slots[slug] ?? emptySlot
}

export const useTweetReplyComposerActions = (slug: string) => {
  const set = useAtomSet(tweetReplyComposerAtom)

  return useMemo(() => {
    const update = (patch: Partial<ComposerSlot>) =>
      set((state) => ({
        slots: {
          ...state.slots,
          [slug]: { ...emptySlot, ...state.slots[slug], ...patch }
        }
      }))

    return {
      open: () => update({ isOpen: true }),
      setDraft: (draft: string) => update({ draft }),
      setMusicUrl: (musicUrl: string) => update({ musicUrl }),
      clearMusicUrl: () => update({ musicUrl: '' }),
      reset: () =>
        set((state) => {
          const nextSlots = { ...state.slots }
          delete nextSlots[slug]
          return { slots: nextSlots }
        })
    }
  }, [set, slug])
}
