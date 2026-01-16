import { useEffect } from 'react'
import { useSession } from '@/lib/auth-client'
import { type User, useAuthStore } from '@/store/auth'

export function useAuthSync() {
  const { data: session, isPending } = useSession()
  const setUser = useAuthStore((state) => state.setUser)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  useEffect(() => {
    if (isPending) return

    if (session?.user) {
      setUser(session.user as User)
    } else {
      clearAuth()
    }
  }, [session, isPending, setUser, clearAuth])
  // console.log('session:', session)

  return { isPending }
}
