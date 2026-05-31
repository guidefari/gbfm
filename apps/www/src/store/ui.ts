import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type SortOption = 'date' | 'title'

interface UIState {
  mixesSorting: {
    sortBy: SortOption
    sortOrder: 'asc' | 'desc'
  }
  showBottomPlayer: boolean
}

interface UIActions {
  setSortBy: (sortBy: SortOption) => void
  toggleSortOrder: () => void
  setShowBottomPlayer: (show: boolean) => void
  resetUI: () => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        mixesSorting: {
          sortBy: 'date',
          sortOrder: 'desc'
        },
        showBottomPlayer: true,
        setSortBy: (sortBy: SortOption) =>
          set(
            (state: UIStore) => ({
              mixesSorting: { ...state.mixesSorting, sortBy }
            }),
            false,
            'ui/mixesSorting/setSortBy'
          ),
        toggleSortOrder: () =>
          set(
            (state: UIStore) => ({
              mixesSorting: {
                ...state.mixesSorting,
                sortOrder: state.mixesSorting.sortOrder === 'asc' ? 'desc' : 'asc'
              }
            }),
            false,
            'ui/mixesSorting/toggleSortOrder'
          ),
        setShowBottomPlayer: (show: boolean) =>
          set(() => ({ showBottomPlayer: show }), false, 'ui/setShowBottomPlayer'),
        resetUI: () =>
          set(
            {
              mixesSorting: { sortBy: 'date', sortOrder: 'desc' },
              showBottomPlayer: true
            },
            false,
            'ui/reset'
          )
      }),
      {
        name: 'gbfm-ui-store',
        partialize: (state) => ({
          mixesSorting: state.mixesSorting,
          showBottomPlayer: state.showBottomPlayer
        })
      }
    ),
    {
      name: 'ui-store'
    }
  )
)
