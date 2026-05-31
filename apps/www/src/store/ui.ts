import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type SortOption = 'date' | 'title'
export type PlayerType = 'full' | 'compact'

interface UIState {
  mixesSorting: {
    sortBy: SortOption
    sortOrder: 'asc' | 'desc'
  }
  showCompactPlayer: boolean
  preferredPlayerType: PlayerType
}

interface UIActions {
  setSortBy: (sortBy: SortOption) => void
  toggleSortOrder: () => void
  toggleCompactPlayer: () => void
  setPreferredPlayerType: (playerType: PlayerType) => void
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
        showCompactPlayer: false,
        preferredPlayerType: 'full',
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
                sortOrder:
                  state.mixesSorting.sortOrder === 'asc' ? 'desc' : 'asc'
              }
            }),
            false,
            'ui/mixesSorting/toggleSortOrder'
          ),
        toggleCompactPlayer: () =>
          set(
            (state: UIStore) => ({
              showCompactPlayer: !state.showCompactPlayer
            }),
            false,
            'ui/toggleCompactPlayer'
          ),
        setPreferredPlayerType: (playerType: PlayerType) =>
          set(
            () => ({
              preferredPlayerType: playerType,
              showCompactPlayer: playerType === 'compact'
            }),
            false,
            'ui/setPreferredPlayerType'
          ),
        resetUI: () =>
          set(
            {
              mixesSorting: { sortBy: 'date', sortOrder: 'desc' },
              showCompactPlayer: false,
              preferredPlayerType: 'full'
            },
            false,
            'ui/reset'
          )
      }),
      {
        name: 'gbfm-ui-store',
        partialize: (state) => ({
          mixesSorting: state.mixesSorting,
          showCompactPlayer: state.showCompactPlayer,
          preferredPlayerType: state.preferredPlayerType
        })
      }
    ),
    {
      name: 'ui-store'
    }
  )
)
