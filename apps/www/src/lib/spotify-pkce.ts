import {
  type BrowserRefreshableTokens,
  readAuthorizationCallback,
  SpotifyBrowser
} from '@spotify-effect/browser'
import type { PrivateUser, SpotifyRequestError } from '@spotify-effect/core'
import { SpotifyHttpError, SpotifyRateLimitError } from '@spotify-effect/core'
import * as Effect from 'effect/Effect'

export const SPOTIFY_WEB_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
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

export const getSpotifyRedirectUri = () => `${window.location.origin}/admin/playlists`

export const spotifyUriFromUrl = (url: string): string | null => {
  const match = url.match(/spotify\.com\/track\/([A-Za-z0-9]+)/)
  if (!match?.[1]) return null
  return `spotify:track:${match[1]}`
}

export const spotifyIdFromUrl = (url: string): string | null => {
  const match = url.match(/spotify\.com\/track\/([A-Za-z0-9]+)/)
  return match?.[1] ?? null
}

export const startSpotifyPkceLoginEffect = Effect.fn('startSpotifyPkceLogin')(function* (
  scopes: readonly SpotifyWebScope[]
) {
  const spotify = yield* SpotifyBrowser
  return yield* spotify.auth.startPkceLogin({
    scopes,
    redirectUri: getSpotifyRedirectUri()
  })
})

export const exchangeSpotifyPkceCodeEffect = Effect.fn('exchangeSpotifyPkceCode')(function* (
  code: string
) {
  const spotify = yield* SpotifyBrowser
  return yield* spotify.auth.exchangeCode(code)
})

export const getValidSpotifyAuthSessionEffect = Effect.fn('getValidSpotifyAuthSession')(
  function* () {
    const spotify = yield* SpotifyBrowser
    const session = spotify.auth.getTokens()
    if (!session) return undefined
    if (session.accessTokenExpiresAt - Date.now() > 60_000) return session
    return yield* spotify.auth.refreshToken(session.refreshToken)
  }
)

export const fetchSpotifyProfileEffect = Effect.fn('fetchSpotifyProfile')(function* () {
  const spotify = yield* SpotifyBrowser
  return yield* spotify.users.getCurrentUserProfile()
})

export const logoutSpotifyEffect = Effect.fn('logoutSpotify')(function* () {
  const spotify = yield* SpotifyBrowser
  spotify.auth.logout()
})

export const playTrackEffect = Effect.fn('playTrack')(function* (spotifyTrackUri: string) {
  const spotify = yield* SpotifyBrowser
  yield* spotify.player.play({ uris: [spotifyTrackUri] })
})

export const addToQueueEffect = Effect.fn('addToQueue')(function* (spotifyTrackUri: string) {
  const spotify = yield* SpotifyBrowser
  yield* spotify.player.addToQueue(spotifyTrackUri)
})

export const saveTrackEffect = Effect.fn('saveTrack')(function* (spotifyTrackId: string) {
  const spotify = yield* SpotifyBrowser
  yield* spotify.library.saveTracks([spotifyTrackId])
})

export const checkSavedTracksEffect = Effect.fn('checkSavedTracks')(function* (
  spotifyTrackIds: string[]
) {
  const spotify = yield* SpotifyBrowser
  if (spotifyTrackIds.length === 0) return new Map<string, boolean>()

  const entries: Array<[string, boolean]> = []
  for (let i = 0; i < spotifyTrackIds.length; i += 50) {
    const batch = spotifyTrackIds.slice(i, i + 50)
    const results = yield* spotify.library.areTracksSaved(batch)
    for (let j = 0; j < batch.length; j += 1) {
      const id = batch[j]
      if (!id) continue
      entries.push([id, results[j] ?? false])
    }
  }

  return new Map(entries)
})

export const checkSavedTrackEffect = Effect.fn('checkSavedTrack')(function* (
  spotifyTrackId: string
) {
  const results = yield* checkSavedTracksEffect([spotifyTrackId])
  return results.get(spotifyTrackId) ?? false
})

export const spotifyErrorMessage = (error: SpotifyRequestError): string => {
  if (error instanceof SpotifyHttpError && error.status === 404) return 'No active Spotify device'
  if (error instanceof SpotifyRateLimitError) return 'Too many requests, try again shortly'
  return error.message
}

export type { SpotifyRequestError }
