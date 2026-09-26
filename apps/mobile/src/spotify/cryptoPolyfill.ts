import * as Crypto from 'expo-crypto'

import { hasGlobal, setGlobal } from './globalPolyfill'

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const toBase64 = (bytes: Uint8Array): string => {
  let output = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    const chunk = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0)

    output += BASE64_CHARS[(chunk >> 18) & 0x3f]
    output += BASE64_CHARS[(chunk >> 12) & 0x3f]
    output += b1 === undefined ? '=' : BASE64_CHARS[(chunk >> 6) & 0x3f]
    output += b2 === undefined ? '=' : BASE64_CHARS[chunk & 0x3f]
  }

  return output
}

const btoaPolyfill = (binary: string): string => {
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)

  return toBase64(bytes)
}

type CryptoPrimitives = Pick<typeof Crypto, 'CryptoDigestAlgorithm' | 'digest' | 'getRandomValues'>

const makeDigestPolyfill =
  (crypto: CryptoPrimitives) =>
  async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
    const name = algorithm instanceof Object ? algorithm.name : algorithm

    if (name !== 'SHA-256') {
      throw new Error(`Unsupported digest algorithm on mobile Spotify crypto shim: ${name}`)
    }

    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

    return crypto.digest(crypto.CryptoDigestAlgorithm.SHA256, bytes)
  }

// Expo/Hermes lacks crypto.subtle and btoa, which @spotify-effect/browser's PKCE flow calls as bare globals.
export const installSpotifyCryptoPolyfill = (crypto: CryptoPrimitives = Crypto) => {
  if (!hasGlobal('crypto')) {
    setGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView | null>(typedArray: T) => {
        if (typedArray === null) return typedArray

        const bytes = new Uint8Array(
          typedArray.buffer,
          typedArray.byteOffset,
          typedArray.byteLength,
        )

        bytes.set(crypto.getRandomValues(new Uint8Array(bytes.length)))

        return typedArray
      },
      subtle: { digest: makeDigestPolyfill(crypto) },
    })
  }

  if (!hasGlobal('btoa')) {
    setGlobal('btoa', btoaPolyfill)
  }
}
