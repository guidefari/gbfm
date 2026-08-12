import { SPOTIFY_REDIRECT_URI } from './constants'
import { hasGlobal, setGlobal } from './globalPolyfill'

// @spotify-effect/browser reads window.location.href unconditionally when clearing PKCE callback params.
export const installSpotifyWindowShim = () => {
  if (!hasGlobal('window')) {
    setGlobal('window', { location: { href: SPOTIFY_REDIRECT_URI } })
    return
  }

  const existingWindow = globalThis.window
  if (!existingWindow.location) {
    Reflect.set(existingWindow, 'location', { href: SPOTIFY_REDIRECT_URI })
  }
}
