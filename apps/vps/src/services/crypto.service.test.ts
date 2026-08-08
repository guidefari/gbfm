import { Effect, Layer, Redacted } from 'effect'
import { describe, expect, test } from 'vitest'
import { ConfigService } from './config.service'
import { CryptoService, CryptoServiceLayer } from './crypto.service'

const layer = CryptoServiceLayer.pipe(
  Layer.provide(
    Layer.succeed(ConfigService, {
      database: { host: '', port: 5432, user: '', password: '', name: '' },
      urls: { frontend: '', vps: '', bucketRouter: '' },
      auth: {
        emailSender: '',
        accessTokenSecret: '',
        refreshTokenSecret: '',
        betterAuthSecret: '',
        betterAuthUrl: ''
      },
      encryption: { rootKey: 'test-root-key' },
      spotify: { clientId: '', clientSecret: '' },
      buckets: { userContent: '', databaseBackups: '', mixes: '' },
      tasks: { databaseBackup: undefined },
      resources: { available: false },
      app: { stage: 'test', nodeEnv: 'test', dbStage: undefined, logLevel: undefined },
      otel: { endpoint: undefined, headers: undefined },
      sentry: { dsn: '', environment: 'test' },
      adminEmail: ''
    })
  )
)

describe('CryptoService', () => {
  test('round trips encrypted values without exposing plaintext in the envelope', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const crypto = yield* CryptoService
        const envelope = yield* crypto.encrypt(Redacted.make('app-password'))
        const plaintext = yield* crypto.decrypt(envelope)
        return { envelope, plaintext: Redacted.value(plaintext) }
      }).pipe(Effect.provide(layer))
    )

    expect(result.envelope.payload).not.toContain('app-password')
    expect(result.plaintext).toBe('app-password')
  })

  test('rejects tampered ciphertext', async () => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const crypto = yield* CryptoService
          const envelope = yield* crypto.encrypt(Redacted.make('secret'))
          yield* crypto.decrypt({ ...envelope, payload: `${envelope.payload}tampered` })
        }).pipe(Effect.provide(layer))
      )
    ).rejects.toMatchObject({ _tag: 'CryptoError', operation: 'decrypt' })
  })
})
