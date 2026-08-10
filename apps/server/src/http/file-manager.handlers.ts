import { Api } from '@gbfm/api/api'
import { AuthSession } from '@gbfm/api/middleware/auth'
import { Effect } from 'effect'
import { HttpApiBuilder, HttpApiError } from 'effect/unstable/httpapi'
import { ConfigService } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

const requireAdmin = Effect.gen(function* () {
  const { user } = yield* AuthSession
  if (user.role !== 'admin') {
    return yield* new HttpApiError.Forbidden()
  }
})

export const FileManagerHandlersLive = HttpApiBuilder.group(Api, 'fileManager', (handlers) =>
  handlers
    .handle('getFileManagerConfig', () =>
      Effect.gen(function* () {
        yield* requireAdmin

        const config = yield* ConfigService
        const s3Service = yield* S3Service
        const configuredBuckets = [config.buckets.userContent, config.buckets.mixes]
        const additionalBuckets =
          config.storage.provider === 'aws'
            ? (process.env.FILE_MANAGER_BUCKETS ?? '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            : []

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
          new Set(
            [...configuredBuckets, ...additionalBuckets, ...discoveredBuckets].filter(Boolean)
          )
        ).toSorted((a, b) => a.localeCompare(b))

        return {
          stage: config.app.stage,
          bucketRouterUrl: config.urls.bucketRouter,
          buckets: {
            userContent: config.buckets.userContent,
            mixes: config.buckets.mixes
          },
          availableBuckets
        }
      })
    )
    .handle('listFileManagerObjects', ({ query }) =>
      Effect.gen(function* () {
        yield* requireAdmin

        const s3Service = yield* S3Service
        const objects = yield* s3Service.listObjects(query.prefix ?? '', query.bucketName).pipe(
          Effect.catchTag('S3Error', (error) =>
            Effect.gen(function* () {
              yield* Effect.logError('[FileManager] List objects error', {
                bucketName: query.bucketName,
                prefix: query.prefix,
                error: error.message
              })
              return yield* new HttpApiError.InternalServerError()
            })
          )
        )

        return {
          objects: objects.map((obj) => ({
            key: obj.key,
            lastModified: obj.lastModified.toISOString(),
            size: obj.size
          }))
        }
      })
    )
)
