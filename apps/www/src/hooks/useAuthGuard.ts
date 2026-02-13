import { useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { useAuthPromptStore } from '@/store/authPrompt'

type ContentType = 'mix' | 'show'

export function useAuthGuard(contentType: ContentType = 'mix') {
  const { isAuthenticated } = useAuthStore()
  const open = useAuthPromptStore((s) => s.open)

  const requireAuth = useCallback(
    (action: () => void | Promise<void>) => {
      if (!isAuthenticated) {
        open(contentType, () => action())
        return
      }
      action()
    },
    [isAuthenticated, contentType, open]
  )

  return { requireAuth }
}
