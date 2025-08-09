import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type SortOption = 'date' | 'title'

interface UIState {
  Cmd: {
    isOpen: boolean
  }
  mixesSorting: {
    sortBy: SortOption
    sortOrder: 'asc' | 'desc'
  }
}

interface UIActions {
  openCmd: () => void
  closeCmd: () => void
  toggleCmd: () => void
  setSortBy: (sortBy: SortOption) => void
  toggleSortOrder: () => void
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
          )
      }),
      {
        name: 'gbfm-ui-store',
        partialize: (state) => ({
          mixesSorting: state.mixesSorting
          // Don't persist Cmd state (isOpen should always start as false)
        })
      }
    ),
    {
      name: 'ui-store'
    }
  )
)
