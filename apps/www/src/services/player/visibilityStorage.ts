const FULLSCREEN_VISIBILITY_KEY = 'gbfm-player-fullscreen'

type VisibilityStorage = Pick<Storage, 'getItem' | 'setItem'>

const browserStorage = (): VisibilityStorage | undefined => {
  if (!('window' in globalThis)) return undefined

  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/** Reads fullscreen visibility synchronously so the initial atom state is
 * available before React's first render. Invalid or unavailable storage falls
 * back to the normal collapsed player. */
export const readStoredFullscreenVisibility = (
  storage: VisibilityStorage | undefined = browserStorage()
): boolean => {
  if (!storage) return false

  try {
    return storage.getItem(FULLSCREEN_VISIBILITY_KEY) === 'true'
  } catch {
    return false
  }
}

export const persistFullscreenVisibility = (
  isVisible: boolean,
  storage: VisibilityStorage | undefined = browserStorage()
): void => {
  if (!storage) return

  try {
    storage.setItem(FULLSCREEN_VISIBILITY_KEY, String(isVisible))
  } catch {
    // Player visibility should continue to work when storage is unavailable.
  }
}
