import { Redacted, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { createConfig, StorageConfigSchema, type WorkerConfigBindings } from './config.service'

const decodeStorageConfig = Schema.decodeUnknownSync(StorageConfigSchema)

const workerBindings = (): WorkerConfigBindings => ({
  APP_STAGE: 'd1-staging',
  USER_CONTENT_BUCKET_NAME: 'user-content',
  MIXES_BUCKET_NAME: 'mixes',
  SENTRY_ENVIRONMENT: 'd1-staging',
  SpotifyClientId: 'configured',
  SpotifyClientSecret: 'configured',
  DatabaseHost: 'configured',
  DatabaseUser: 'configured',
  DatabasePassword: 'configured',
  DatabasePort: '5432',
  DatabaseName: 'configured',
  SENTRY_BACKEND_DSN: 'configured',
  VITE_PUBLIC_SENTRY_DSN: 'configured',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'configured',
  OTEL_EXPORTER_OTLP_HEADERS: 'configured',
  BETTER_AUTH_SECRET: 'configured',
  BETTER_AUTH_URL: 'configured',
  GBFM_ENCRYPTION_ROOT_KEY: 'configured',
  StorageProvider: 'aws',
  StorageEndpoint: 'configured',
  StorageRegion: 'configured',
  StorageAccessKeyId: 'configured',
  StorageSecretAccessKey: 'configured',
  StorageSigningEndpoint: 'configured'
})

describe('StorageConfigSchema', () => {
  test('uses Worker bindings instead of SST resources', () => {
    const config = createConfig(workerBindings())

    expect(config.spotify).toEqual({ clientId: 'configured', clientSecret: 'configured' })
    expect(config.auth.betterAuthSecret).toBe('configured')
    expect(config.encryption.rootKey).toBe('configured')
  })

  test('rejects missing production Worker secrets', () => {
    expect(() =>
      createConfig({ ...workerBindings(), APP_STAGE: 'prod', BETTER_AUTH_SECRET: '' })
    ).toThrow('Missing required production secrets: BETTER_AUTH_SECRET')
  })

  test('accepts AWS with ambient credentials', () => {
    expect(decodeStorageConfig({ provider: 'aws', region: 'us-east-1' })).toMatchObject({
      provider: 'aws',
      region: 'us-east-1'
    })
  })

  test('derives the R2 account ID from the API endpoint binding', () => {
    const config = createConfig({
      ...workerBindings(),
      StorageProvider: 'r2',
      StorageEndpoint: 'https://test-account.r2.cloudflarestorage.com'
    })

    expect(config.storage.accountId).toBe('test-account')
  })

  test('rejects R2 without its account ID and credentials', () => {
    expect(() => decodeStorageConfig({ provider: 'r2', region: 'auto' })).toThrow(
      /r2 provider requires an account ID and credentials/
    )
  })

  test('does not serialize R2 credentials', () => {
    const accessKey = 'r2-access-key-for-test'
    const secretKey = 'r2-secret-key-for-test'
    const config = decodeStorageConfig({
      provider: 'r2',
      accountId: 'account',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      region: 'auto',
      accessKeyId: Redacted.make(accessKey),
      secretAccessKey: Redacted.make(secretKey)
    })

    expect(String(config)).not.toContain(accessKey)
    expect(String(config)).not.toContain(secretKey)
    expect(JSON.stringify(config)).not.toContain(accessKey)
    expect(JSON.stringify(config)).not.toContain(secretKey)
  })
})
