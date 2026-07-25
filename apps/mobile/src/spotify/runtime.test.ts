import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
          ? Effect.fail(new Error('layer build failed'))
          : Effect.succeed('spotify-browser-service')
      )
  })
}))

describe('runSpotifyEffect', () => {
  beforeEach(() => {
    vi.resetModules()
    hoisted.clientId = 'test-client-id'
    hoisted.hydrateCalls = 0
    hoisted.cryptoPolyfillCalls = 0
    hoisted.windowShimCalls = 0
    hoisted.layerBuildShouldFail = false
  })

  it('does not run polyfills or hydration until the first effect runs', async () => {
    await import('./runtime')

    expect(hoisted.cryptoPolyfillCalls).toBe(0)
    expect(hoisted.windowShimCalls).toBe(0)
    expect(hoisted.hydrateCalls).toBe(0)
  })

  it('builds the context lazily on first use and reuses it afterwards', async () => {
    const { runSpotifyEffect } = await import('./runtime')

    await runSpotifyEffect(Effect.succeed('first'))
    expect(hoisted.hydrateCalls).toBe(1)
    expect(hoisted.cryptoPolyfillCalls).toBe(1)

    await runSpotifyEffect(Effect.succeed('second'))
    expect(hoisted.hydrateCalls).toBe(1)
    expect(hoisted.cryptoPolyfillCalls).toBe(1)
  })

  it('fails with a clear error instead of building a layer when the client id is unset', async () => {
    hoisted.clientId = undefined
    const { runSpotifyEffect } = await import('./runtime')

    await expect(runSpotifyEffect(Effect.succeed('unused'))).rejects.toMatchObject({
      message: 'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID.'
    })
  })

  it('does not permanently poison the memoized promise after a failed init', async () => {
    hoisted.layerBuildShouldFail = true
    const { runSpotifyEffect } = await import('./runtime')

    await expect(runSpotifyEffect(Effect.succeed('first attempt'))).rejects.toThrow()

    hoisted.layerBuildShouldFail = false
    const result = await runSpotifyEffect(Effect.succeed('second attempt'))
    expect(result).toBe('second attempt')
  })
})
