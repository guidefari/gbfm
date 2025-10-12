import { create } from 'zustand'
import type { User, LoginResponse } from '@gbfm/core/api'

type AuthState = {
  user: User | null
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
