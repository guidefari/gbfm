import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { authClient } from '@/lib/auth-client'

export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null | undefined
  createdAt: Date
  updatedAt: Date
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

interface AuthActions {
  setUser: (user: User | null) => void
  clearAuth: () => void
  refreshSession: () => Promise<void>
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isAuthenticated: false,

        setUser: (user) =>
          set(
            {
              user,
              isAuthenticated: !!user
            },
            false,
            'auth/setUser'
          ),

        clearAuth: () =>
          set(
            {
              user: null,
              isAuthenticated: false
            },
            false,
            'auth/clear'
          ),

        refreshSession: async () => {
          const session = await authClient.getSession()
          if (session.data) {
            set(
              {
                user: session.data.user as User,
                isAuthenticated: true
              },
              false,
              'auth/refreshSession'
            )
          } else {
            set(
              {
                user: null,
                isAuthenticated: false
              },
              false,
              'auth/sessionExpired'
            )
          }
        }
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated
        })
      }
    )
  )
)
