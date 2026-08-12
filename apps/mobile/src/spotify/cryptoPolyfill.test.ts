import { afterEach, expect, test, vi } from 'vitest'

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

test('installs working base64 and crypto primitives when the platform globals are missing', async () => {
  replaceGlobal('btoa', undefined)
  replaceGlobal('crypto', undefined)
  expect(hasGlobal('crypto')).toBe(false)

  installSpotifyCryptoPolyfill()

  for (const value of ['', 'a', 'ab', 'abc', 'abcd', 'hello']) {
    expect(globalThis.btoa(value)).toBe(originalBtoa(value))
  }

  const bytes = new Uint8Array([1, 2, 3])
  expect(globalThis.crypto.getRandomValues(bytes)).toBe(bytes)
  await expect(globalThis.crypto.subtle.digest('SHA-256', bytes)).resolves.toEqual(bytes.buffer)
})

test('preserves base64 and crypto primitives already supplied by the platform', () => {
  const customBtoa = (value: string) => `custom:${value}`
  const customCrypto = { marker: 'existing' }
  replaceGlobal('btoa', customBtoa)
  replaceGlobal('crypto', customCrypto)

  installSpotifyCryptoPolyfill()

  expect(globalThis.btoa('hello')).toBe('custom:hello')
  expect(globalThis.crypto).toBe(customCrypto)
})
