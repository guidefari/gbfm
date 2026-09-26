export const CryptoDigestAlgorithm = {
  SHA256: 'SHA-256',
} as const

export const getRandomValues = <Value extends ArrayBufferView>(value: Value): Value => value

export const digest = async (
  _algorithm: (typeof CryptoDigestAlgorithm)[keyof typeof CryptoDigestAlgorithm],
  value: BufferSource,
): Promise<ArrayBuffer> =>
  value instanceof ArrayBuffer
    ? value
    : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
