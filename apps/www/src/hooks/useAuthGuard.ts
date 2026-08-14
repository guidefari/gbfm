import { useCallback } from 'react'
import { useSession } from '@/lib/auth-client'
import { useAuthPromptActions } from '@/store/authPrompt'

type ContentType = 'mix' | 'show'

export function useAuthGuard(contentType: ContentType = 'mix') {
  const { data: session } = useSession()
  const isAuthenticated = Boolean(session?.user)
  const { open } = useAuthPromptActions()

  const requireAuth = useCallback(
    (action: () => void | Promise<void>) => {
      if (!isAuthenticated) {
        open(contentType, () => action())
        return
      }
      void action()
    },
    [isAuthenticated, contentType, open]
  )

  return { requireAuth }
}
