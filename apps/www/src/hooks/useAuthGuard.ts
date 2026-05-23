import { useCallback } from 'react'
import { useSession } from '@/lib/auth-client'
import { useAuthPromptStore } from '@/store/authPrompt'

type ContentType = 'mix' | 'show'

export function useAuthGuard(contentType: ContentType = 'mix') {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
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
