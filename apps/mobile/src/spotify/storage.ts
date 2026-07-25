import * as SecureStore from 'expo-secure-store'

const TOKENS_STORAGE_KEY = 'spotify-effect:tokens'
const SECURE_STORE_KEY = 'gbfm_spotify_tokens'

const secureStoreWritable = new Set([TOKENS_STORAGE_KEY])

const makeMemoryStorage = (): Storage => {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, value)
    }
  }
}

const memoryLocalStorage = makeMemoryStorage()
const memorySessionStorage = makeMemoryStorage()

export const hydrateSpotifyTokensFromSecureStore = async () => {
  const stored = await SecureStore.getItemAsync(SECURE_STORE_KEY).catch(() => null)
  if (stored) memoryLocalStorage.setItem(TOKENS_STORAGE_KEY, stored)
}

export const spotifyLocalStorage: Storage = {
  get length() {
    return memoryLocalStorage.length
  },
  clear: () => {
    memoryLocalStorage.clear()
    void SecureStore.deleteItemAsync(SECURE_STORE_KEY).catch(() => {})
  },
  getItem: (key) => memoryLocalStorage.getItem(key),
  key: (index) => memoryLocalStorage.key(index),
  removeItem: (key) => {
    memoryLocalStorage.removeItem(key)
    if (secureStoreWritable.has(key)) {
      void SecureStore.deleteItemAsync(SECURE_STORE_KEY).catch(() => {})
    }
  },
  setItem: (key, value) => {
    memoryLocalStorage.setItem(key, value)
    if (secureStoreWritable.has(key)) {
      void SecureStore.setItemAsync(SECURE_STORE_KEY, value).catch(() => {})
    }
  }
}

export const spotifySessionStorage: Storage = memorySessionStorage

export const spotifyHistoryStub: History = {
  length: 0,
  scrollRestoration: 'auto',
  state: null,
  back: () => {},
  forward: () => {},
  go: () => {},
  pushState: () => {},
  replaceState: () => {}
}
