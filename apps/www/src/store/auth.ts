import { jwtDecode } from 'jwt-decode'
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { fetcher, VPS_BASE_URL } from '@/lib/http'

interface JWTPayload {
  sub: string
  email: string
  type: 'access' | 'refresh'
  exp: number
  iat: number
}

export interface User {
  id: string
  name: string
  username: string
  email: string
  verified: boolean
  createdAt: string
  updatedAt: string
  avatarUrl: string | null
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isRefreshing: boolean
  refreshTimeout: ReturnType<typeof setTimeout> | null
}

interface AuthActions {
  setAuth: (auth: {
    user: User
    accessToken: string
    refreshToken: string
  }) => void
  clearAuth: () => void
  updateUser: (userData: Partial<User>) => void
  getAccessToken: () => Promise<string | null>
  refreshAccessToken: () => Promise<string | null>
  scheduleTokenRefresh: (token: string) => void
  clearTokenRefresh: () => void
  refreshUser: () => Promise<void>
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isRefreshing: false,
        refreshTimeout: null,
        setAuth: (auth) => {
          set(
            () => ({
              user: auth.user,
              accessToken: auth.accessToken,
              refreshToken: auth.refreshToken,
              isAuthenticated: true
            }),
            false,
            'auth/set'
          )

          get().scheduleTokenRefresh(auth.accessToken)
        },
        clearAuth: () => {
          get().clearTokenRefresh()
          set(
            () => ({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isRefreshing: false
            }),
            false,
            'auth/clear'
          )
        },
        updateUser: (userData) =>
          set(
            (state: AuthStore) => ({
              user: state.user ? { ...state.user, ...userData } : null
            }),
            false,
            'auth/updateUser'
          ),
        getAccessToken: async () => {
          const { accessToken } = get()
          if (!accessToken) {
            return null
          }

          try {
            const decoded = jwtDecode<JWTPayload>(accessToken)
            const now = Math.floor(Date.now() / 1000)

            if (decoded.exp <= now + 300) {
              return await get().refreshAccessToken()
            }

            return accessToken
          } catch (error) {
            console.error('Error decoding token:', error)
            return null
          }
        },
        refreshAccessToken: async () => {
          const { isRefreshing, refreshToken } = get()
          if (isRefreshing || !refreshToken) {
            return get().accessToken
          }

          set({ isRefreshing: true }, false, 'auth/refreshStart')

          try {
            const response = await fetch(`${VPS_BASE_URL}/auth/refresh-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ refreshToken })
            })

            if (response.ok) {
              const data = await response.json()
              const newAccessToken = data.accessToken

              set(
                { accessToken: newAccessToken, isRefreshing: false },
                false,
                'auth/refreshSuccess'
              )

              if (newAccessToken) {
                get().scheduleTokenRefresh(newAccessToken)
              }

              return newAccessToken
            }

            console.error('Failed to refresh token:', response.status)
            set({ isRefreshing: false }, false, 'auth/refreshFailed')
            return null
          } catch (error) {
            console.error('Error refreshing token:', error)
            set({ isRefreshing: false }, false, 'auth/refreshError')
            return null
          }
        },
        scheduleTokenRefresh: (token: string) => {
          try {
            const decoded = jwtDecode<JWTPayload>(token)
            const now = Math.floor(Date.now() / 1000)
            const timeUntilExpiry = decoded.exp - now

            const refreshTime = Math.max((timeUntilExpiry - 300) * 1000, 1000)

            get().clearTokenRefresh()

            const timeout = setTimeout(async () => {
              await get().refreshAccessToken()
            }, refreshTime)

            set({ refreshTimeout: timeout }, false, 'auth/refreshScheduled')

            console.log(
              `Token refresh scheduled in ${refreshTime / 1000} seconds`
            )
          } catch (error) {
            console.error(
              'Failed to decode token for scheduling refresh:',
              error
            )
          }
        },
        clearTokenRefresh: () => {
          const { refreshTimeout } = get()
          if (refreshTimeout) {
            clearTimeout(refreshTimeout)
            set({ refreshTimeout: null }, false, 'auth/refreshCleared')
          }
        },
        refreshUser: async () => {
          const { accessToken, refreshToken } = get()
          if (!accessToken || !refreshToken) return

          const response = await fetcher<{
            user: User
            accessToken: string
            refreshToken: string
          }>(`${VPS_BASE_URL}/auth/profile`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`
            }
          })

          set({
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken
          })
        }
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated
        })
      }
    )
  )
)
