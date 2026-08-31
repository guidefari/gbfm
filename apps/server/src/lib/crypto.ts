import { Crypto, Effect, Layer } from 'effect'

/**
 * Platform-agnostic `Crypto` layer backed by the global WebCrypto API.
 * Works on Bun, Node >= 19, browsers, and edge runtimes.
 *
 * Digest failures are defects: the algorithms we request are constant and
 * always supported by WebCrypto, so there is no recoverable error to model.
 */
export const CryptoLive = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
    digest: (algorithm, data) =>
      Effect.orDie(
        Effect.promise(async () => new Uint8Array(await crypto.subtle.digest(algorithm, data)))
      )
  })
)
