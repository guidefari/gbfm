import type { LoginResponse, FullUser } from '@gbfm/core/api'
import { create } from 'zustand'

type AuthState = {
  user: FullUser | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (data: LoginResponse) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
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
}))
