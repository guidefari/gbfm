import { Redacted, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  ConfigService,
  createConfig,
  StorageConfigSchema,
  WorkerConfigServiceLayer,
  type WorkerConfigBindings
} from './config.service'
import { Effect } from 'effect'
import { withTestLayer } from '@/test/effect'

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

  test('points a non-prod stage at its own deployed CDN router', () => {
    const config = createConfig({
      ...workerBindings(),
      CDN_ROUTER_URL: 'https://cdn-router-d1-staging.workers.dev'
    })

    expect(config.urls.bucketRouter).toBe('https://cdn-router-d1-staging.workers.dev')
  })

  test('keeps the production CDN domain regardless of the bound router url', () => {
    const config = createConfig({
      ...workerBindings(),
      APP_STAGE: 'prod',
      CDN_ROUTER_URL: 'https://cdn-router-prod.workers.dev'
    })

    expect(config.urls.bucketRouter).toBe('https://cdn.goosebumps.fm')
  })

  test('falls back to the production CDN when no router url is bound', () => {
    const config = createConfig(workerBindings())

    expect(config.urls.bucketRouter).toBe('https://cdn.goosebumps.fm')
  })

  test('rejects an invalid configured full email sender at the Worker config boundary', () => {
    expect(() =>
      Effect.runSync(
        withTestLayer(
          ConfigService,
          WorkerConfigServiceLayer({ ...workerBindings(), EMAIL_SENDER: 'noreply' })
        )
      )
    ).toThrow()
  })

  test('rejects missing production Worker secrets', () => {
    expect(() =>
      createConfig({ ...workerBindings(), APP_STAGE: 'prod', BETTER_AUTH_SECRET: '' })
    ).toThrow('Missing required production secrets: BETTER_AUTH_SECRET')
  })

  // A D1 Worker binds no Postgres credentials: it reaches the database through
  // its `DB` binding. Requiring them here takes the Worker down at boot.
  test('boots in production without the Postgres credentials', () => {
    const { DatabaseHost, DatabaseUser, DatabasePassword, DatabasePort, DatabaseName, ...d1 } =
      workerBindings()

    const config = createConfig({ ...d1, APP_STAGE: 'prod', R2AccountId: 'account' })

    expect(config.app.stage).toBe('prod')
    expect(config.database.port).toBe(5432)
  })

  test('accepts AWS with ambient credentials', () => {
    expect(decodeStorageConfig({ provider: 'aws', region: 'us-east-1' })).toMatchObject({
      provider: 'aws',
      region: 'us-east-1'
    })
  })

  test('uses the R2 account ID Worker binding', () => {
    const config = createConfig({
      ...workerBindings(),
      StorageProvider: 'r2',
      R2AccountId: 'test-account'
    })

    expect(config.storage.accountId).toBe('test-account')
  })

  test('rejects R2 without its account ID', () => {
    expect(() => decodeStorageConfig({ provider: 'r2', region: 'auto' })).toThrow(
      /r2 provider requires an account ID/
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

    expect(JSON.stringify(config)).not.toContain(accessKey)
    expect(JSON.stringify(config)).not.toContain(secretKey)
  })
})
