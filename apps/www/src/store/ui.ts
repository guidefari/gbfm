import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type SortOption = 'date' | 'title'
export type PlayerType = 'full' | 'compact'

interface UIState {
  Cmd: {
    isOpen: boolean
  }
  mixesSorting: {
    sortBy: SortOption
    sortOrder: 'asc' | 'desc'
  }
  showCompactPlayer: boolean
  preferredPlayerType: PlayerType
}

interface UIActions {
  openCmd: () => void
  closeCmd: () => void
  toggleCmd: () => void
  setSortBy: (sortBy: SortOption) => void
  toggleSortOrder: () => void
  toggleCompactPlayer: () => void
  setPreferredPlayerType: (playerType: PlayerType) => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        Cmd: {
          isOpen: false
        },
        mixesSorting: {
          sortBy: 'date',
          sortOrder: 'desc'
        },
        showCompactPlayer: false,
        preferredPlayerType: 'full',
        openCmd: () =>
          set(
            (state: UIStore) => ({
              Cmd: { ...state.Cmd, isOpen: true }
            }),
            false,
            'ui/Cmd/open'
          ),
        closeCmd: () =>
          set(
            (state: UIStore) => ({
              Cmd: { ...state.Cmd, isOpen: false }
            }),
            false,
            'ui/Cmd/close'
          ),
        toggleCmd: () =>
          set(
            (state: UIStore) => ({
              Cmd: { ...state.Cmd, isOpen: !state.Cmd.isOpen }
            }),
            false,
            'ui/Cmd/toggle'
          ),
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
