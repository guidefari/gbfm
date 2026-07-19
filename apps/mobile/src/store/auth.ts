import type { FullUser } from '@gbfm/core/api'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useAtomMount, useAtomSet, useAtomValue } from '@effect/atom-react'
import { type PropsWithChildren, useMemo } from 'react'
import { Effect, Schema } from 'effect'
import * as SecureStore from 'expo-secure-store'
import { getSession, SessionExpired } from '@/api/auth'

export type AuthSession = {
  readonly user: FullUser | null
  readonly sessionToken: string | null
}

const emptyAuthState: AuthSession = { user: null, sessionToken: null }

const PersistedAuthSession = Schema.Struct({
  user: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    username: Schema.NullOr(Schema.String),
    email: Schema.String,
    avatarUrl: Schema.NullOr(Schema.String),
    verified: Schema.Boolean,
    createdAt: Schema.String,
    updatedAt: Schema.String
  }),
  sessionToken: Schema.String
})

const storageKey = 'gbfm.auth-session'
export const authState = Atom.make<AuthSession>(emptyAuthState).pipe(Atom.keepAlive)

const persistAuth = (session: AuthSession) =>
  session.user && session.sessionToken
    ? Effect.tryPromise(() => SecureStore.setItemAsync(storageKey, JSON.stringify(session)))
    : Effect.tryPromise(() => SecureStore.deleteItemAsync(storageKey))

const makeRestoreAuth = (setState: (session: AuthSession) => void) =>
  Effect.gen(function* () {
    const stored = yield* Effect.tryPromise(() => SecureStore.getItemAsync(storageKey)).pipe(
      Effect.catch(() => Effect.succeed(null))
    )
    if (!stored) return

    const cached = yield* Effect.try({ try: () => JSON.parse(stored), catch: () => null }).pipe(
      Effect.flatMap((value) => Schema.decodeUnknownEffect(PersistedAuthSession)(value)),
      Effect.catch(() => Effect.succeed(null))
    )
    if (!cached) {
      yield* Effect.tryPromise(() => SecureStore.deleteItemAsync(storageKey)).pipe(Effect.ignore)
      return
    }

    setState(cached)

    yield* getSession(cached.sessionToken).pipe(
      Effect.tap((user) =>
        Effect.gen(function* () {
          const refreshed = { user, sessionToken: cached.sessionToken }
          setState(refreshed)
          yield* persistAuth(refreshed)
        })
      ),
      Effect.catch((error) =>
        error instanceof SessionExpired
          ? Effect.gen(function* () {
              setState(emptyAuthState)
              yield* persistAuth(emptyAuthState)
            })
          : Effect.void
      )
    )
  })

const makeRestoreAuthAtom = (setState: (session: AuthSession) => void) =>
  Atom.make(makeRestoreAuth(setState))

export const useAuthStore = <T>(selector: (state: AuthSession) => T) =>
  useAtomValue(authState, selector)

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const setState = useAtomSet(authState)
  const restoreAtom = useMemo(() => makeRestoreAuthAtom(setState), [setState])
  useAtomMount(restoreAtom)
  return children
}

export const useSetAuth = () => {
  const setState = useAtomSet(authState)
  return (session: AuthSession) => {
    setState(session)
    return persistAuth(session)
  }
}

export const useClearAuth = () => {
  const setState = useAtomSet(authState)
  return () => {
    setState(emptyAuthState)
    return persistAuth(emptyAuthState)
  }
}
