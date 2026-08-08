import { Effect, Layer, Redacted } from 'effect'
import { afterEach, describe, expect, test } from 'vitest'
import { config, ConfigService } from '../config.service'
import { ObjectStoreClient, ObjectStoreClientLayer } from './object-store-client'

const originalAwsRegion = process.env.AWS_REGION

afterEach(() => {
  if (originalAwsRegion === undefined) delete process.env.AWS_REGION
  else process.env.AWS_REGION = originalAwsRegion
})

const endpointHostname = async (client: ObjectStoreClient['client']) => {
  const endpoint = client.config.endpoint
  if (typeof endpoint !== 'function') return undefined
  return (await endpoint()).hostname
}

const inspectClient = (storage: ConfigService['storage']) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* ObjectStoreClient
      const endpoint = yield* Effect.promise(() => endpointHostname(store.client))
      const region = yield* Effect.promise(() => store.client.config.region())
      const signingEndpoint = yield* Effect.promise(() => endpointHostname(store.signingClient))
      return {
        provider: store.provider,
        endpoint,
        region,
        sameClientForSigning: store.client === store.signingClient,
        signingEndpoint
      }
    }).pipe(
      Effect.provide(
        ObjectStoreClientLayer.pipe(
          Layer.provide(Layer.succeed(ConfigService, { ...config, storage }))
        )
      )
    )
  )

describe('ObjectStoreClientLayer', () => {
  test('configures the R2 endpoint, region, and signing endpoint', async () => {
    const result = await inspectClient({
      provider: 'r2',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      region: 'auto',
      accessKeyId: Redacted.make('access-key'),
      secretAccessKey: Redacted.make('secret-key'),
      signingEndpoint: 'https://signing.r2.cloudflarestorage.com'
    })

    expect(result).toEqual({
      provider: 'r2',
      endpoint: 'account.r2.cloudflarestorage.com',
      region: 'auto',
      sameClientForSigning: false,
      signingEndpoint: 'signing.r2.cloudflarestorage.com'
    })
  })

  test('preserves ambient AWS region resolution', async () => {
    process.env.AWS_REGION = 'eu-west-2'

    const result = await inspectClient({
      provider: 'aws',
      region: 'must-not-override-ambient-aws'
    })

    expect(result.provider).toBe('aws')
    expect(result.region).toBe('eu-west-2')
    expect(result.endpoint).toBeUndefined()
    expect(result.sameClientForSigning).toBe(true)
    expect(result.signingEndpoint).toBeUndefined()
  })
})
