import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { Schema } from 'effect'
import { persistedAtom } from './persistedAtom'

export type SortOption = 'date' | 'title'

const UIState = Schema.Struct({
  mixesSorting: Schema.Struct({
    sortBy: Schema.Literals(['date', 'title']),
    sortOrder: Schema.Literals(['asc', 'desc'])
  }),
  showBottomPlayer: Schema.Boolean
})

export type UIState = (typeof UIState)['Type']

const initialUIState: UIState = {
  mixesSorting: { sortBy: 'date', sortOrder: 'desc' },
  showBottomPlayer: true
}

const { atom: uiAtom, write } = persistedAtom({
  key: 'gbfm-ui-state.json',
  schema: UIState,
  fallback: initialUIState
})

export { uiAtom }

export const useUIState = () => useAtomValue(uiAtom)

export const useUIActions = () => {
  const set = useAtomSet(uiAtom)

  const update = (next: (state: UIState) => UIState) =>
    set((state) => {
      const value = next(state)
      write(value)
      return value
    })

  return {
    setSortBy: (sortBy: SortOption) =>
      update((state) => ({ ...state, mixesSorting: { ...state.mixesSorting, sortBy } })),
    toggleSortOrder: () =>
      update((state) => ({
        ...state,
        mixesSorting: {
          ...state.mixesSorting,
          sortOrder: state.mixesSorting.sortOrder === 'asc' ? 'desc' : 'asc'
        }
      })),
    setShowBottomPlayer: (showBottomPlayer: boolean) =>
      update((state) => ({ ...state, showBottomPlayer })),
    resetUI: () => update(() => initialUIState)
  }
}
