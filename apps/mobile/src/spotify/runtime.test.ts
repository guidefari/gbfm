import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { beforeEach, expect, test, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  let clientId: string | undefined
  return {
    get clientId() {
      return clientId
    },
    set clientId(value: string | undefined) {
      clientId = value
    },
    hydrateCalls: 0,
    cryptoPolyfillCalls: 0,
    windowShimCalls: 0,
    layerBuildShouldFail: false
  }
})

vi.mock('@/env', () => ({
  env: {
    get EXPO_PUBLIC_SPOTIFY_CLIENT_ID() {
      return hoisted.clientId
    }
  }
}))

vi.mock('./cryptoPolyfill', () => ({
  installSpotifyCryptoPolyfill: () => {
    hoisted.cryptoPolyfillCalls += 1
  }
}))

vi.mock('./windowShim', () => ({
  installSpotifyWindowShim: () => {
    hoisted.windowShimCalls += 1
  }
}))

vi.mock('./storage', () => ({
  hydrateSpotifyTokensFromSecureStore: async () => {
    hoisted.hydrateCalls += 1
  },
  spotifyLocalStorage: {},
  spotifySessionStorage: {},
  spotifyHistoryStub: {}
}))

const SpotifyBrowserTag = Context.Service<string>('test/SpotifyBrowser')

vi.mock('@spotify-effect/browser', () => ({
  SpotifyBrowser: Object.assign(SpotifyBrowserTag, {
    layer: () =>
      Layer.effect(
        SpotifyBrowserTag,
        hoisted.layerBuildShouldFail
          ? Effect.fail({ _tag: 'LayerBuildFailed' })
          : Effect.succeed('spotify-browser-service')
      )
  })
}))

beforeEach(() => {
  vi.resetModules()
  hoisted.clientId = 'test-client-id'
  hoisted.hydrateCalls = 0
  hoisted.cryptoPolyfillCalls = 0
  hoisted.windowShimCalls = 0
  hoisted.layerBuildShouldFail = false
})

test('initializes Spotify lazily on first use and reuses that context for later effects', async () => {
  const { runSpotifyEffect } = await import('./runtime')

  expect(hoisted.cryptoPolyfillCalls).toBe(0)
  expect(hoisted.windowShimCalls).toBe(0)
  expect(hoisted.hydrateCalls).toBe(0)

  await expect(runSpotifyEffect(Effect.succeed('first'))).resolves.toBe('first')
  expect(hoisted.hydrateCalls).toBe(1)
  expect(hoisted.cryptoPolyfillCalls).toBe(1)
  expect(hoisted.windowShimCalls).toBe(1)

  await expect(runSpotifyEffect(Effect.succeed('second'))).resolves.toBe('second')
  expect(hoisted.hydrateCalls).toBe(1)
  expect(hoisted.cryptoPolyfillCalls).toBe(1)
  expect(hoisted.windowShimCalls).toBe(1)
})

test('fails with a clear error instead of building a Spotify layer without a client id', async () => {
  hoisted.clientId = undefined
  const { runSpotifyEffect } = await import('./runtime')

  await expect(runSpotifyEffect(Effect.succeed('unused'))).rejects.toMatchObject({
    message: 'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID.'
  })
})

test('retries Spotify initialization after a failed layer build instead of caching the rejection', async () => {
  hoisted.layerBuildShouldFail = true
  const { runSpotifyEffect } = await import('./runtime')

  await expect(runSpotifyEffect(Effect.succeed('first attempt'))).rejects.toThrow()

  hoisted.layerBuildShouldFail = false
  await expect(runSpotifyEffect(Effect.succeed('second attempt'))).resolves.toBe('second attempt')
})
