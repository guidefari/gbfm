import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ContentState {
  currentContent: {
    id: string
    archetype: string
    creatorIds: string[]
  } | null
}

interface ContentActions {
  setCurrentContent: (
    content: { id: string; archetype: string; creatorIds: string[] } | null
  ) => void
  canEditCurrent: (userId: string) => boolean
}

type ContentStore = ContentState & ContentActions

export const useContentStore = create<ContentStore>()(
  devtools(
    (set, get) => ({
      currentContent: null,
      setCurrentContent: (content) => {
        set({ currentContent: content }, false, 'content/setCurrent')
      },
      canEditCurrent: (userId: string) => {
        const { currentContent } = get()
        if (!currentContent) return false
        return currentContent.creatorIds.includes(userId)
      }
    }),
    {
      name: 'content-store'
    }
  )
)
