export {
  addToQueueEffect,
  checkSavedTrackEffect,
  checkSavedTracksEffect,
  collectEntityTrackUrisEffect,
  exchangeSpotifyPkceCodeEffect,
  fetchSpotifyProfileEffect,
  getValidSpotifyAuthSessionEffect,
  hasActiveSpotifyDeviceEffect,
  logoutSpotifyEffect,
  playSpotifyEntityEffect,
  playTrackEffect,
  queueSpotifyEntityEffect,
  readAuthorizationCallback,
  saveTrackEffect,
  SPOTIFY_ENTITY_KIND,
  SPOTIFY_WEB_SCOPES,
  spotifyEntityFromUrl,
  spotifyErrorMessage,
  spotifyIdFromUrl,
  startSpotifyPkceLoginEffect,
  spotifyUriFromUrl,
  type SpotifyAuthSession,
  type SpotifyEntityKind,
  type SpotifyEntityRef,
  type SpotifyProfile,
  type SpotifyRequestError,
  type SpotifyWebScope
} from '@gbfm/spotify'

export const clearAuthorizationCallback = (url: URL) => {
  window.history.replaceState({}, '', `${url.origin}${url.pathname}`)
}

const RETURN_PATH_KEY = 'gbfm:spotify-return-path'

export const storeSpotifyReturnPath = (path: string) => {
  window.sessionStorage.setItem(RETURN_PATH_KEY, path)
}

/** Only same-origin absolute paths, so a poisoned value cannot become an open redirect. */
export const takeSpotifyReturnPath = (): string => {
  const stored = window.sessionStorage.getItem(RETURN_PATH_KEY)
  window.sessionStorage.removeItem(RETURN_PATH_KEY)
  if (!stored || !stored.startsWith('/') || stored.startsWith('//')) return '/dashboard/player'
  return stored
}

export const notifySpotifySessionChanged = () => {
  window.dispatchEvent(new Event('spotify-session-changed'))
}

export const SPOTIFY_CALLBACK_PATH = '/spotify/callback'

export const getSpotifyRedirectUri = () => `${window.location.origin}${SPOTIFY_CALLBACK_PATH}`
