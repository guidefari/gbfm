import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Context, Effect, Layer, Redacted } from 'effect'
import type { CiphertextEnvelope } from '@/db/external-account.schema'
import { CryptoError } from '@/errors'
import { ConfigService } from './config.service'

export interface CryptoService {
  readonly encrypt: (
    plaintext: Redacted.Redacted<string>
  ) => Effect.Effect<CiphertextEnvelope, CryptoError>
  readonly decrypt: (
    envelope: CiphertextEnvelope
  ) => Effect.Effect<Redacted.Redacted<string>, CryptoError>
}

export const CryptoService = Context.Service<CryptoService>('CryptoService')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const resolveKey = (rootKey: string): Effect.Effect<Buffer, CryptoError> =>
  Effect.try({
    try: () => createHash('sha256').update(rootKey, 'utf8').digest(),
    catch: () =>
      new CryptoError({
        message: 'Unable to resolve encryption key',
        operation: 'keyResolve'
      })
  })

const encrypt = (
  rootKey: string,
  plaintext: Redacted.Redacted<string>
): Effect.Effect<CiphertextEnvelope, CryptoError> =>
  resolveKey(rootKey).pipe(
    Effect.flatMap((key) =>
      Effect.try({
        try: () => {
          const iv = randomBytes(IV_LENGTH)
          const cipher = createCipheriv(ALGORITHM, key, iv)
          const payload = Buffer.concat([
            cipher.update(Redacted.value(plaintext), 'utf8'),
            cipher.final()
          ])

          return {
            keyId: 'sha256',
            iv: toBase64Url(iv),
            authTag: toBase64Url(cipher.getAuthTag()),
            payload: toBase64Url(payload)
          }
        },
        catch: () => new CryptoError({ message: 'Unable to encrypt secret', operation: 'encrypt' })
      })
    )
  )

const decrypt = (
  rootKey: string,
  envelope: CiphertextEnvelope
): Effect.Effect<Redacted.Redacted<string>, CryptoError> =>
  resolveKey(rootKey).pipe(
    Effect.flatMap((key) =>
      Effect.try({
        try: () => {
          const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, 'base64url'))
          decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64url'))
          const plaintext = Buffer.concat([
            decipher.update(Buffer.from(envelope.payload, 'base64url')),
            decipher.final()
          ]).toString('utf8')

          return Redacted.make(plaintext)
        },
        catch: () => new CryptoError({ message: 'Unable to decrypt secret', operation: 'decrypt' })
      })
    )
  )

export const CryptoServiceLayer = Layer.effect(
  CryptoService,
  Effect.gen(function* () {
    const config = yield* ConfigService
    return {
      encrypt: (plaintext) => encrypt(config.encryption.rootKey, plaintext),
      decrypt: (envelope) => decrypt(config.encryption.rootKey, envelope)
    }
  })
)
