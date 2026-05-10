import {
  type BrowserRefreshableTokens,
  readAuthorizationCallback,
  SpotifyBrowser
} from '@spotify-effect/browser'
import type { PrivateUser } from '@spotify-effect/core'
import * as Effect from 'effect/Effect'
import { env } from '@/env'

export const SPOTIFY_WEB_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private'
] as const

export type SpotifyWebScope = (typeof SPOTIFY_WEB_SCOPES)[number]
export type SpotifyAuthSession = BrowserRefreshableTokens
export type SpotifyProfile = PrivateUser

export { readAuthorizationCallback }

export const clearAuthorizationCallback = (url: URL) => {
  window.history.replaceState({}, '', `${url.origin}${url.pathname}`)
}

export const getSpotifyRedirectUri = () =>
  `${window.location.origin}/admin/playlists`

const spotifyLayer = SpotifyBrowser.layer({
  clientId: env.spotifyClientId,
  redirectUri: getSpotifyRedirectUri(),
  session: {
    sessionStorage: window.sessionStorage,
    localStorage: window.localStorage,
    history: window.history
  }
})

export const startSpotifyPkceLoginEffect = ({
  scopes
}: {
  scopes: readonly SpotifyWebScope[]
}) =>
  Effect.gen(function* () {
    const spotify = yield* SpotifyBrowser
    return yield* spotify.auth.startPkceLogin({
      scopes,
      redirectUri: getSpotifyRedirectUri()
    })
  }).pipe(Effect.provide(spotifyLayer))

export const exchangeSpotifyPkceCodeEffect = ({ code }: { code: string }) =>
  Effect.gen(function* () {
    const spotify = yield* SpotifyBrowser
    return yield* spotify.auth.exchangeCode(code)
  }).pipe(Effect.provide(spotifyLayer))

export const getValidSpotifyAuthSessionEffect = () =>
  Effect.gen(function* () {
    const spotify = yield* SpotifyBrowser
    const session = spotify.auth.getTokens()

    if (!session) return undefined

    if (session.accessTokenExpiresAt - Date.now() > 60_000) {
      return session
    }

    return yield* spotify.auth.refreshToken(session.refreshToken)
  }).pipe(Effect.provide(spotifyLayer))

export const fetchSpotifyProfileEffect = () =>
  Effect.gen(function* () {
    const spotify = yield* SpotifyBrowser
    return yield* spotify.users.getCurrentUserProfile()
  }).pipe(Effect.provide(spotifyLayer))

export const logoutSpotifyEffect = () =>
  Effect.gen(function* () {
    const spotify = yield* SpotifyBrowser
    spotify.auth.logout()
  }).pipe(Effect.provide(spotifyLayer))
