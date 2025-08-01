import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export type SortOption = 'date' | 'title'

interface UIState {
  commando: {
    isOpen: boolean
  }
  mixesSorting: {
    sortBy: SortOption
    sortOrder: 'asc' | 'desc'
  }
}

interface UIActions {
  openCommando: () => void
  closeCommando: () => void
  toggleCommando: () => void
  setSortBy: (sortBy: SortOption) => void
  toggleSortOrder: () => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set) => ({
        commando: {
          isOpen: false
        },
        mixesSorting: {
          sortBy: 'date',
          sortOrder: 'desc'
        },
        openCommando: () =>
          set(
            (state: UIStore) => ({
              commando: { ...state.commando, isOpen: true }
            }),
            false,
            'ui/commando/open'
          ),
        closeCommando: () =>
          set(
            (state: UIStore) => ({
              commando: { ...state.commando, isOpen: false }
            }),
            false,
            'ui/commando/close'
          ),
        toggleCommando: () =>
          set(
            (state: UIStore) => ({
              commando: { ...state.commando, isOpen: !state.commando.isOpen }
            }),
            false,
            'ui/commando/toggle'
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
          // Don't persist commando state (isOpen should always start as false)
        })
      }
    ),
    {
      name: 'ui-store'
    }
  )
)
