import type { FullUser, LoginResponse } from '@gbfm/core/api'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

type AuthState = {
  user: FullUser | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (data: LoginResponse) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (data) =>
        set({
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken
        }),
      clearAuth: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null
        })
    }),
    { name: 'AuthStore' }
  )
)
