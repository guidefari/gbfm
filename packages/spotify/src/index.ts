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

export const SPOTIFY_ENTITY_KIND = {
  TRACK: 'track',
  ALBUM: 'album',
  PLAYLIST: 'playlist'
} as const

export type SpotifyEntityKind = (typeof SPOTIFY_ENTITY_KIND)[keyof typeof SPOTIFY_ENTITY_KIND]

export type SpotifyEntityRef = {
  kind: SpotifyEntityKind
  id: string
  uri: string
}

const ENTITY_URL_PATTERN = /spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/
const ENTITY_URI_PATTERN = /^spotify:(track|album|playlist):([A-Za-z0-9]+)$/

export const spotifyEntityFromUrl = (url: string): SpotifyEntityRef | null => {
  const match = url.match(ENTITY_URL_PATTERN) ?? url.match(ENTITY_URI_PATTERN)
  const kind = match?.[1]
  const id = match?.[2]
  if (!kind || !id) return null
  if (kind !== 'track' && kind !== 'album' && kind !== 'playlist') return null
  return { kind, id, uri: `spotify:${kind}:${id}` }
}

export const spotifyUriFromUrl = (url: string): string | null => {
  const entity = spotifyEntityFromUrl(url)
  if (!entity || entity.kind !== SPOTIFY_ENTITY_KIND.TRACK) return null
  return entity.uri
}

export const spotifyIdFromUrl = (url: string): string | null => {
  const entity = spotifyEntityFromUrl(url)
  if (!entity || entity.kind !== SPOTIFY_ENTITY_KIND.TRACK) return null
  return entity.id
}

export const startSpotifyPkceLoginEffect = Effect.fn('startSpotifyPkceLogin')(function* (
  scopes: readonly SpotifyWebScope[],
  redirectUri: string
) {
  const spotify = yield* Effect.service(SpotifyBrowser)
  return yield* spotify.auth.startPkceLogin({ scopes, redirectUri })
})

export const exchangeSpotifyPkceCodeEffect = Effect.fn('exchangeSpotifyPkceCode')(function* (
  code: string
) {
  const spotify = yield* Effect.service(SpotifyBrowser)
  return yield* spotify.auth.exchangeCode(code)
})

export const getValidSpotifyAuthSessionEffect = Effect.fn('getValidSpotifyAuthSession')(
  function* () {
    const spotify = yield* Effect.service(SpotifyBrowser)
    const session = spotify.auth.getTokens()
    if (!session) return undefined
    if (session.accessTokenExpiresAt - Date.now() > 60_000) return session
    return yield* spotify.auth.refreshToken(session.refreshToken)
  }
)

export const fetchSpotifyProfileEffect = Effect.fn('fetchSpotifyProfile')(function* () {
  const spotify = yield* Effect.service(SpotifyBrowser)
  return yield* spotify.users.getCurrentUserProfile()
})

export const logoutSpotifyEffect = Effect.fn('logoutSpotify')(function* () {
  const spotify = yield* Effect.service(SpotifyBrowser)
  spotify.auth.logout()
})

export const playTrackEffect = Effect.fn('playTrack')(function* (spotifyTrackUri: string) {
  const spotify = yield* Effect.service(SpotifyBrowser)
  yield* spotify.player.play({ uris: [spotifyTrackUri] })
})

export const addToQueueEffect = Effect.fn('addToQueue')(function* (spotifyTrackUri: string) {
  const spotify = yield* Effect.service(SpotifyBrowser)
  yield* spotify.player.addToQueue(spotifyTrackUri)
})

export const hasActiveSpotifyDeviceEffect = Effect.fn('hasActiveSpotifyDevice')(function* () {
  const spotify = yield* Effect.service(SpotifyBrowser)
  const devices = yield* spotify.player.getMyDevices()
  return devices.length > 0
})

const QUEUE_TRACK_LIMIT = 50

export const collectEntityTrackUrisEffect = Effect.fn('collectEntityTrackUris')(function* (
  entity: SpotifyEntityRef
) {
  const spotify = yield* Effect.service(SpotifyBrowser)

  if (entity.kind === SPOTIFY_ENTITY_KIND.TRACK) return [entity.uri]

  if (entity.kind === SPOTIFY_ENTITY_KIND.ALBUM) {
    const page = yield* spotify.albums.getAlbumTracks(entity.id, { limit: QUEUE_TRACK_LIMIT })
    return page.items.map((track) => track.uri).filter((uri): uri is string => Boolean(uri))
  }

  const page = yield* spotify.playlists.getPlaylistItems(entity.id, { limit: QUEUE_TRACK_LIMIT })
  return page.items.map((item) => item.track?.uri).filter((uri): uri is string => Boolean(uri))
})

/**
 * Albums and playlists start as a Spotify playback *context* so the rest of the
 * record keeps playing after the first track; a bare `uris` array would stop dead
 * at the end of it.
 */
export const playSpotifyEntityEffect = Effect.fn('playSpotifyEntity')(function* (
  entity: SpotifyEntityRef
) {
  const spotify = yield* Effect.service(SpotifyBrowser)

  if (entity.kind === SPOTIFY_ENTITY_KIND.TRACK) {
    yield* spotify.player.play({ uris: [entity.uri] })
    return
  }

  yield* spotify.player.play({ context_uri: entity.uri })
})

export const queueSpotifyEntityEffect = Effect.fn('queueSpotifyEntity')(function* (
  entity: SpotifyEntityRef
) {
  const spotify = yield* Effect.service(SpotifyBrowser)
  const uris = yield* collectEntityTrackUrisEffect(entity)

  for (const uri of uris) {
    yield* spotify.player.addToQueue(uri)
  }

  return uris.length
})

export const saveTrackEffect = Effect.fn('saveTrack')(function* (spotifyTrackId: string) {
  const spotify = yield* Effect.service(SpotifyBrowser)
  yield* spotify.library.saveTracks([spotifyTrackId])
})

export const checkSavedTracksEffect = Effect.fn('checkSavedTracks')(function* (
  spotifyTrackIds: string[]
) {
  const spotify = yield* Effect.service(SpotifyBrowser)
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
