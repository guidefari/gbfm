import { getFormFile, getFormString } from '@gbfm/core/utils'
import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { ValidationError } from '@/errors'
import { runEffect } from '@/lib/effect-hono'
import type { AppBindings, AppRouteHandler } from '@/lib/types'
import { ConfigService } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

import type {
  AbortMultipartRoute,
  CompleteMultipartRoute,
  InitMultipartRoute,
  MultipartStatusRoute,
  UploadPartRoute
} from './upload-multipart.routes'
import type { Context } from 'hono'

const CHUNK_SIZE = 10 * 1024 * 1024
const MAX_AUDIO_SIZE = 200 * 1024 * 1024
const MAX_CHUNK_SIZE = CHUNK_SIZE * 2

const sanitizeKeySegment = (value: string): string => value.replace(/[^a-zA-Z0-9.-]/g, '_')

const buildObjectKey = (userId: string, fileType: string, fileName: string): string => {
  const timestamp = Date.now()
  const sanitizedName = sanitizeKeySegment(fileName)
  return `${sanitizeKeySegment(userId)}/${fileType}_${timestamp}_${sanitizedName}`
}

const validateKeyOwnership = (c: Context<AppBindings>, key: string): string | null => {
  const user = c.get('user')
  const prefix = `${sanitizeKeySegment(user.id)}/`
  if (!key.startsWith(prefix)) {
    return 'Upload key does not belong to current user'
  }
  return null
}

export const assertContiguousParts = (parts: ReadonlyArray<{ partNumber: number }>): void => {
  const sorted = parts.toSorted((a, b) => a.partNumber - b.partNumber)
  for (const [index, part] of sorted.entries()) {
    if (part.partNumber !== index + 1) {
      throw new ValidationError({
        message: `Parts must be contiguous starting at 1. Missing part ${index + 1}`
      })
    }
  }
}

export const initMultipart: AppRouteHandler<InitMultipartRoute> = async (c) => {
  const body = c.req.valid('json')
  const user = c.get('user')

  if (body.fileSize > MAX_AUDIO_SIZE) {
    return c.json(
      { error: `File too large. Maximum size is ${MAX_AUDIO_SIZE / (1024 * 1024)}MB` },
      HttpStatusCodes.REQUEST_TOO_LONG
    )
  }

  const key = buildObjectKey(user.id, body.fileType, body.fileName)

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
        fileSize: body.fileSize,
        userId: user.id
      }
    }),
    Effect.tapError((error) =>
      Effect.logError('[Upload] Multipart init error', { key, error: getMessage(error) })
    )
  )

  return runEffect<InitMultipartRoute>(c, program)
}

export const uploadPart: AppRouteHandler<UploadPartRoute> = async (c) => {
  const formData = await c.req.formData()

  const key = getFormString(formData, 'key')
  const uploadId = getFormString(formData, 'uploadId')
  const partNumber = Number.parseInt(getFormString(formData, 'partNumber'), 10)
  const chunk = getFormFile(formData, 'chunk')

  if (!key || !uploadId || !chunk) {
    return c.json({ error: 'Missing key, uploadId, or chunk' }, HttpStatusCodes.BAD_REQUEST)
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

  const ownershipError = validateKeyOwnership(c, key)
  if (ownershipError) {
    return c.json({ error: ownershipError }, HttpStatusCodes.BAD_REQUEST)
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
    return { partNumber: result.partNumber, etag: result.etag, size: result.size }
  }).pipe(
    Effect.withSpan('api.upload.multipart.part', {
      attributes: { key, partNumber, chunkSize: chunk.size }
    }),
    Effect.tapError((error) =>
      Effect.logError('[Upload] Multipart part error', {
        key,
        partNumber,
        error: getMessage(error)
      })
    )
  )

  return runEffect<UploadPartRoute>(c, program)
}

export const completeMultipart: AppRouteHandler<CompleteMultipartRoute> = async (c) => {
  const body = c.req.valid('json')

  const ownershipError = validateKeyOwnership(c, body.key)
  if (ownershipError) {
    return c.json({ error: ownershipError }, HttpStatusCodes.BAD_REQUEST)
  }

  try {
    assertContiguousParts(body.parts)
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.json({ error: error.message }, HttpStatusCodes.BAD_REQUEST)
    }
    throw error
  }

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    yield* s3Service.completeMultipartUpload(
      body.key,
      body.uploadId,
      body.parts,
      config.buckets.userContent
    )
    return { url: `${config.urls.bucketRouter}/user-content/${body.key}`, key: body.key }
  }).pipe(
    Effect.withSpan('api.upload.multipart.complete', {
      attributes: { key: body.key, partCount: body.parts.length }
    }),
    Effect.tapError((error) =>
      Effect.logError('[Upload] Multipart complete error', {
        key: body.key,
        error: getMessage(error)
      })
    )
  )

  return runEffect<CompleteMultipartRoute>(c, program)
}

export const abortMultipart: AppRouteHandler<AbortMultipartRoute> = async (c) => {
  const body = c.req.valid('json')

  const ownershipError = validateKeyOwnership(c, body.key)
  if (ownershipError) {
    return c.json({ error: ownershipError }, HttpStatusCodes.BAD_REQUEST)
  }

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    yield* s3Service.abortMultipartUpload(body.key, body.uploadId, config.buckets.userContent)
  }).pipe(
    Effect.withSpan('api.upload.multipart.abort', { attributes: { key: body.key } }),
    Effect.tapError((error) =>
      Effect.logError('[Upload] Multipart abort error', {
        key: body.key,
        error: getMessage(error)
      })
    ),
    Effect.map(() => ({ ok: true as const }))
  )

  return runEffect<AbortMultipartRoute>(c, program)
}

export const multipartStatus: AppRouteHandler<MultipartStatusRoute> = async (c) => {
  const { key, uploadId } = c.req.valid('query')

  const ownershipError = validateKeyOwnership(c, key)
  if (ownershipError) {
    return c.json({ error: ownershipError }, HttpStatusCodes.BAD_REQUEST)
  }

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const parts = yield* s3Service.listMultipartParts(key, uploadId, config.buckets.userContent)
    return { parts }
  }).pipe(
    Effect.withSpan('api.upload.multipart.status', { attributes: { key } }),
    Effect.tapError((error) =>
      Effect.logError('[Upload] Multipart status error', {
        key,
        error: getMessage(error)
      })
    )
  )

  return runEffect<MultipartStatusRoute>(c, program)
}

const getMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))
