import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { ac, admin, creator, editor, userRole } from './auth-permissions'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_VPS_BASE_URL || 'http://localhost:3003',
  basePath: '/auth',
  plugins: [
    adminClient({
      ac,
      roles: {
        admin,
        editor,
        creator,
        user: userRole
      }
    })
  ]
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  resetPassword,
  requestPasswordReset
} = authClient
