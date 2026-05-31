import { Effect } from 'effect'
import { config } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

const QR_PDFS_PREFIX = 'qr-pdfs/'
const MAX_AGE_MS = 30 * 60 * 1000

export const cleanupExpiredQrPdfs = Effect.gen(function* () {
  yield* Effect.logInfo('Running QR cache cleanup...')
  const s3 = yield* S3Service
  const bucketName = config.buckets.userContent
  yield* Effect.logInfo(`Using bucket: ${bucketName}`)

  const objects = yield* s3
    .listObjects(QR_PDFS_PREFIX, bucketName)
    .pipe(Effect.tapError((e) => Effect.logError(`S3 listObjects failed: ${e.message}`)))

  if (objects.length === 0) {
    yield* Effect.logInfo('No QR PDFs found to clean up')
    return { deleted: 0 }
  }

  const now = Date.now()
  const expiredObjects = objects.filter((obj) => now - obj.lastModified.getTime() > MAX_AGE_MS)

  if (expiredObjects.length === 0) {
    yield* Effect.logInfo(`Found ${objects.length} QR PDFs, none expired`)
    return { deleted: 0 }
  }

  yield* Effect.logInfo(`Deleting ${expiredObjects.length} expired QR PDFs`)

  yield* Effect.forEach(
    expiredObjects,
    (obj) =>
      s3
        .deleteFile(obj.key, bucketName)
        .pipe(
          Effect.catch((error) =>
            Effect.logWarning(`Failed to delete ${obj.key}: ${error.message}`)
          )
        ),
    { concurrency: 5 }
  )

  return { deleted: expiredObjects.length }
}).pipe(
  Effect.withSpan('qr-cache-cleanup', {
    attributes: { prefix: QR_PDFS_PREFIX }
  })
)
