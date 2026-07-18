import type { FullUser, LoginResponse } from '@gbfm/core/api'
import { Atom, useAtomSet, useAtomValue } from '@gbfm/mobile-state'

type AuthState = {
  readonly user: FullUser | null
  readonly accessToken: string | null
  readonly refreshToken: string | null
}

const emptyAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null
}

const authState = Atom.make<AuthState>(emptyAuthState)

export const useAuthStore = <T>(selector: (state: AuthState) => T) =>
  useAtomValue(authState, selector)

export const useSetAuth = () => {
  const setState = useAtomSet(authState)
  return (data: LoginResponse) =>
    setState({
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    })
}

export const useClearAuth = () => {
  const setState = useAtomSet(authState)
  return () => setState(emptyAuthState)
}
