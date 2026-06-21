import { getFormFile, getFormString } from '@gbfm/core/utils'
import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { ValidationError } from '@/errors'
import type { AppRouteHandler } from '@/lib/types'
import { runApp } from '@/runtime'
import { ConfigService } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

import type {
  AbortMultipartRoute,
  CompleteMultipartRoute,
  InitMultipartRoute,
  MultipartStatusRoute,
  UploadPartRoute
} from './upload-multipart.routes'

const CHUNK_SIZE = 10 * 1024 * 1024
const MAX_AUDIO_SIZE = 200 * 1024 * 1024
const MAX_CHUNK_SIZE = CHUNK_SIZE * 2

const sanitizeKeySegment = (value: string): string => value.replace(/[^a-zA-Z0-9.-]/g, '_')

const buildObjectKey = (fileType: string, fileName: string): string => {
  const timestamp = Date.now()
  const sanitizedName = sanitizeKeySegment(fileName)
  return `${fileType}_${timestamp}_${sanitizedName}`
}

export const initMultipart: AppRouteHandler<InitMultipartRoute> = async (c) => {
  const body = c.req.valid('json')

  if (body.fileType !== 'audio' || !body.contentType.startsWith('audio/')) {
    return c.json({ error: 'Only audio uploads are supported' }, HttpStatusCodes.BAD_REQUEST)
  }

  if (body.fileSize > MAX_AUDIO_SIZE) {
    return c.json(
      { error: `File too large. Maximum size is ${MAX_AUDIO_SIZE / (1024 * 1024)}MB` },
      HttpStatusCodes.REQUEST_TOO_LONG
    )
  }

  const key = buildObjectKey(body.fileType, body.fileName)

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const upload = yield* s3Service.createMultipartUpload(
      key,
      body.contentType,
      config.buckets.userContent
    )
    return { uploadId: upload.uploadId, key: upload.key, chunkSize: CHUNK_SIZE }
  }).pipe(
    Effect.withSpan('api.upload.multipart.init', {
      attributes: {
        fileType: body.fileType,
        key,
        fileSize: body.fileSize
      }
    }),
    Effect.map((result) => ({ ...result, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('S3Error', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Upload] Multipart init error', { key, error: error.message })
        return {
          error: 'Failed to initialize multipart upload',
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR
        } as const
      })
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }
  return c.json(
    { uploadId: result.uploadId, key: result.key, chunkSize: result.chunkSize },
    result.status
  )
}

export const uploadPart: AppRouteHandler<UploadPartRoute> = async (c) => {
  const formData = await c.req.formData()

  const key = getFormString(formData, 'key')
  const uploadId = getFormString(formData, 'uploadId')
  const partNumberRaw = getFormString(formData, 'partNumber')
  const chunk = getFormFile(formData, 'chunk')

  if (!key || !uploadId || !chunk) {
    return c.json({ error: 'Missing key, uploadId, or chunk' }, HttpStatusCodes.BAD_REQUEST)
  }

  const partNumber = Number.parseInt(partNumberRaw, 10)
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    return c.json({ error: 'Invalid partNumber' }, HttpStatusCodes.BAD_REQUEST)
  }

  if (chunk.size === 0) {
    return c.json({ error: 'Empty chunk' }, HttpStatusCodes.BAD_REQUEST)
  }

  if (chunk.size > MAX_CHUNK_SIZE) {
    return c.json(
      { error: `Chunk too large. Maximum is ${MAX_CHUNK_SIZE / (1024 * 1024)}MB` },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const buffer = Buffer.from(yield* Effect.promise(() => chunk.arrayBuffer()))
    const result = yield* s3Service.uploadMultipartPart(
      key,
      uploadId,
      partNumber,
      buffer,
      config.buckets.userContent
    )
    return result
  }).pipe(
    Effect.withSpan('api.upload.multipart.part', {
      attributes: {
        key,
        partNumber,
        chunkSize: chunk.size
      }
    }),
    Effect.map(
      (result) =>
        ({
          partNumber: result.partNumber,
          etag: result.etag,
          size: result.size,
          status: HttpStatusCodes.OK
        }) as const
    ),
    Effect.catchTag('S3Error', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Upload] Multipart part error', {
          key,
          partNumber,
          error: error.message
        })
        return {
          error: 'Failed to upload part',
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR
        } as const
      })
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }
  return c.json(
    { partNumber: result.partNumber, etag: result.etag, size: result.size },
    result.status
  )
}

export const completeMultipart: AppRouteHandler<CompleteMultipartRoute> = async (c) => {
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service

    const sortedParts = body.parts.toSorted((a, b) => a.partNumber - b.partNumber)
    const expectedPartNumber = (index: number) => index + 1
    for (const [index, part] of sortedParts.entries()) {
      if (part.partNumber !== expectedPartNumber(index)) {
        return yield* Effect.fail(
          new ValidationError({
            message: `Parts must be contiguous starting at 1. Missing part ${expectedPartNumber(index)}`
          })
        )
      }
    }

    yield* s3Service.completeMultipartUpload(
      body.key,
      body.uploadId,
      sortedParts,
      config.buckets.userContent
    )

    return { url: `${config.urls.bucketRouter}/user-content/${body.key}`, key: body.key }
  }).pipe(
    Effect.withSpan('api.upload.multipart.complete', {
      attributes: {
        key: body.key,
        partCount: body.parts.length
      }
    }),
    Effect.map((result) => ({ ...result, status: HttpStatusCodes.OK }) as const),
    Effect.catchTags({
      ValidationError: (error) =>
        Effect.succeed({
          error: error.message,
          status: HttpStatusCodes.BAD_REQUEST
        } as const),
      S3Error: (error) =>
        Effect.gen(function* () {
          yield* Effect.logError('[Upload] Multipart complete error', {
            key: body.key,
            error: error.message
          })
          return {
            error: 'Failed to complete multipart upload',
            status: HttpStatusCodes.INTERNAL_SERVER_ERROR
          } as const
        })
    })
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }
  return c.json({ url: result.url, key: result.key }, result.status)
}

export const abortMultipart: AppRouteHandler<AbortMultipartRoute> = async (c) => {
  const body = c.req.valid('json')

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    yield* s3Service.abortMultipartUpload(body.key, body.uploadId, config.buckets.userContent)
  }).pipe(
    Effect.withSpan('api.upload.multipart.abort', {
      attributes: { key: body.key }
    }),
    Effect.map(
      () =>
        ({
          ok: true,
          status: HttpStatusCodes.OK
        }) as const
    ),
    Effect.catchTag('S3Error', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Upload] Multipart abort error', {
          key: body.key,
          error: error.message
        })
        return {
          error: 'Failed to abort multipart upload',
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR
        } as const
      })
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }
  return c.json({ ok: true } as const, result.status)
}

export const multipartStatus: AppRouteHandler<MultipartStatusRoute> = async (c) => {
  const { key, uploadId } = c.req.valid('query')

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const parts = yield* s3Service.listMultipartParts(key, uploadId, config.buckets.userContent)
    return { parts }
  }).pipe(
    Effect.withSpan('api.upload.multipart.status', { attributes: { key } }),
    Effect.map((result) => ({ ...result, status: HttpStatusCodes.OK }) as const),
    Effect.catchTag('S3Error', (error) =>
      Effect.gen(function* () {
        yield* Effect.logError('[Upload] Multipart status error', {
          key,
          error: error.message
        })
        return {
          error: 'Failed to fetch multipart status',
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR
        } as const
      })
    )
  )

  const result = await runApp(program)

  if ('error' in result) {
    return c.json({ error: result.error }, result.status)
  }
  return c.json({ parts: result.parts }, result.status)
}
