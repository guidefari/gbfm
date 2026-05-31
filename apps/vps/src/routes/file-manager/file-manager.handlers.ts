import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import type { AppRouteHandler } from '@/lib/types'
import { runApp } from '@/runtime'
import { ConfigService } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

import type { CopyObjectRoute, GetConfigRoute, ListObjectsRoute } from './file-manager.routes'

export const getConfig: AppRouteHandler<GetConfigRoute> = async (c) => {
  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const configuredBuckets = [config.buckets.userContent, config.buckets.mixes]
    const additionalBuckets = (process.env.FILE_MANAGER_BUCKETS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    const discoveredBuckets = yield* s3Service.listBuckets().pipe(
      Effect.catchTag('S3Error', (error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning('[FileManager] Failed to list buckets', {
            error: error.message
          })
          return []
        })
      )
    )

    const availableBuckets = Array.from(
      new Set([...configuredBuckets, ...additionalBuckets, ...discoveredBuckets].filter(Boolean))
    ).toSorted((a, b) => a.localeCompare(b))

    return {
      stage: config.app.stage,
      routerUrl: config.urls.router,
      buckets: {
        userContent: config.buckets.userContent,
        mixes: config.buckets.mixes
      },
      availableBuckets
    }
  })

  const result = await runApp(program)
  return c.json(result, HttpStatusCodes.OK)
}

export const listObjects: AppRouteHandler<ListObjectsRoute> = async (c) => {
  const { bucketName, prefix = '' } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const s3Service = yield* S3Service
    const objects = yield* s3Service.listObjects(prefix, bucketName)
    return objects.map((obj) => ({
      key: obj.key,
      lastModified: obj.lastModified.toISOString(),
      size: obj.size
    }))
  }).pipe(
    Effect.withSpan('api.file-manager.list', {
      attributes: { bucketName, prefix }
    }),
    Effect.map((objects) => ({ objects, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('S3Error', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[FileManager] List objects error', {
          bucketName,
          prefix,
          error: error.message
        })
        return {
          error: 'Failed to list objects',
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR
        } as const
      })
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json({ objects: result.objects }, result.status)
}

export const copyObject: AppRouteHandler<CopyObjectRoute> = async (c) => {
  const { key, sourceBucket, destinationBucket } = c.req.valid('json')

  if (sourceBucket === destinationBucket) {
    return c.json(
      { error: 'Source and destination buckets must be different' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const program = Effect.gen(function* () {
    const s3Service = yield* S3Service
    yield* s3Service.copyFile(key, sourceBucket, destinationBucket)
    return key
  }).pipe(
    Effect.withSpan('api.file-manager.copy', {
      attributes: { key, sourceBucket, destinationBucket }
    }),
    Effect.map((k) => ({ key: k, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('S3Error', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[FileManager] Copy object error', {
          key,
          sourceBucket,
          destinationBucket,
          error: error.message
        })
        return {
          error: 'Failed to copy object',
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR
        } as const
      })
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }

  return c.json({ key: result.key }, result.status)
}
