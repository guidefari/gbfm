import { SPOTIFY_REDIRECT_URI } from './constants'
import { getGlobal, hasGlobal, setGlobal } from './globalPolyfill'

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  typeof value === 'object' && value !== null

// @spotify-effect/browser reads window.location.href unconditionally when clearing PKCE callback params.
export const installSpotifyWindowShim = () => {
  if (!hasGlobal('window')) {
    setGlobal('window', { location: { href: SPOTIFY_REDIRECT_URI } })
    return
  }

  const existingWindow = getGlobal('window')
  if (isRecord(existingWindow) && !existingWindow.location) {
    existingWindow.location = { href: SPOTIFY_REDIRECT_URI }
  }
}
