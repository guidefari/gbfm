import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('expo-crypto', () => ({
  getRandomValues: (bytes: Uint8Array) => bytes,
  digest: async (_algorithm: AlgorithmIdentifier, bytes: Uint8Array) => bytes.buffer,
  CryptoDigestAlgorithm: { SHA256: 'SHA256' }
}))

const { hasGlobal } = await import('./globalPolyfill')
const { installSpotifyCryptoPolyfill } = await import('./cryptoPolyfill')

const originalBtoa = globalThis.btoa
const originalCrypto = globalThis.crypto

const replaceGlobal = <Value>(key: 'btoa' | 'crypto', value: Value) => {
  Reflect.deleteProperty(globalThis, key)
  if (value !== undefined) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
}

afterEach(() => {
  replaceGlobal('btoa', originalBtoa)
  replaceGlobal('crypto', originalCrypto)
})

describe('installSpotifyCryptoPolyfill', () => {
  it('installs btoa that matches the platform implementation', () => {
    replaceGlobal('btoa', undefined)
    installSpotifyCryptoPolyfill()

    expect(globalThis.btoa('hello')).toBe(originalBtoa('hello'))
    expect(globalThis.btoa('')).toBe(originalBtoa(''))
    expect(globalThis.btoa('a')).toBe(originalBtoa('a'))
    expect(globalThis.btoa('ab')).toBe(originalBtoa('ab'))
    expect(globalThis.btoa('abc')).toBe(originalBtoa('abc'))
    expect(globalThis.btoa('abcd')).toBe(originalBtoa('abcd'))
  })

  it('does not overwrite an existing btoa', () => {
    const customBtoa = (value: string) => `custom:${value}`
    replaceGlobal('btoa', customBtoa)

    installSpotifyCryptoPolyfill()

    expect(globalThis.btoa('hello')).toBe('custom:hello')
  })

  it('does not overwrite an existing crypto global', () => {
    const customCrypto = { marker: 'existing' }
    replaceGlobal('crypto', customCrypto)

    installSpotifyCryptoPolyfill()

    expect(globalThis.crypto).toBe(customCrypto)
  })

  it('installs crypto.getRandomValues and crypto.subtle.digest when crypto is missing', () => {
    replaceGlobal('crypto', undefined)
    expect(hasGlobal('crypto')).toBe(false)

    installSpotifyCryptoPolyfill()

    expect(globalThis.crypto.getRandomValues).toBeTypeOf('function')
    expect(globalThis.crypto.subtle.digest).toBeTypeOf('function')
  })
})
