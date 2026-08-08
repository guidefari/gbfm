import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3'
import { Context, Effect, Layer, Redacted } from 'effect'
import { ConfigService } from '../config.service'
import { StorageProvider, type StorageProvider as StorageProviderType } from './provider'

/** Configured S3-compatible clients used for object operations and presigning. */
export interface ObjectStoreClient {
  readonly client: S3Client
  readonly provider: StorageProviderType
  /** Signs direct browser writes against an object-store API host, never the public CDN. */
  readonly signingClient: S3Client
}

/** Object-store client dependency. */
export const ObjectStoreClient = Context.Service<ObjectStoreClient>('ObjectStoreClient')

const makeS3Client = (config: S3ClientConfig) => new S3Client(config)

const destroyStore = (store: ObjectStoreClient) =>
  Effect.sync(() => {
    store.client.destroy()
    if (store.signingClient !== store.client) store.signingClient.destroy()
  })

/** Constructs and owns the configured object-store clients. */
export const ObjectStoreClientLayer: Layer.Layer<ObjectStoreClient, never, ConfigService> =
  Layer.effect(
    ObjectStoreClient,
    Effect.gen(function* () {
      const config = yield* ConfigService
      const storage = config.storage

      if (storage.provider === StorageProvider.aws) {
        return yield* Effect.acquireRelease(
          Effect.sync(() => {
            const client = makeS3Client({})
            return {
              client,
              provider: StorageProvider.aws,
              signingClient: client
            } satisfies ObjectStoreClient
          }),
          destroyStore
        )
      }

      if (
        storage.endpoint === undefined ||
        storage.accessKeyId === undefined ||
        storage.secretAccessKey === undefined
      ) {
        return yield* Effect.dieMessage('Parsed R2 storage configuration is incomplete')
      }

      return yield* Effect.acquireRelease(
        Effect.sync(() => {
          const clientConfig: S3ClientConfig = {
            endpoint: storage.endpoint,
            region: storage.region,
            credentials: {
              accessKeyId: Redacted.value(storage.accessKeyId),
              secretAccessKey: Redacted.value(storage.secretAccessKey)
            }
          }
          const client = makeS3Client(clientConfig)
          const signingClient =
            storage.signingEndpoint === undefined || storage.signingEndpoint === storage.endpoint
              ? client
              : makeS3Client({ ...clientConfig, endpoint: storage.signingEndpoint })
          return {
            client,
            provider: StorageProvider.r2,
            signingClient
          } satisfies ObjectStoreClient
        }),
        destroyStore
      )
    })
  )
