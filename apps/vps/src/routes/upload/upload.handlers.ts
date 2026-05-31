import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { runEffect } from '@/lib/effect-hono'
import type { AppRouteHandler } from '@/lib/types'
import { ConfigService } from '@/services/config.service'
import { S3Service } from '@/services/s3.service'

import type { UploadFileRoute } from './upload.routes'

export const uploadFile: AppRouteHandler<UploadFileRoute> = async (c) => {
  const formData = await c.req.formData()
  const fileType = formData.get('fileType') as string

  let file: File | null = null
  if (fileType === 'audio') {
    file = formData.get('audioFile') as File
  } else if (fileType === 'image') {
    file = formData.get('imageFile') as File
  }

  if (!file) {
    return c.json({ error: 'No file provided' }, HttpStatusCodes.BAD_REQUEST)
  }

  const maxSize = fileType === 'audio' ? 200 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > maxSize) {
    return c.json(
      { error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB` },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  if (fileType === 'audio' && !file.type.startsWith('audio/')) {
    return c.json({ error: 'Invalid audio file type' }, HttpStatusCodes.BAD_REQUEST)
  }

  if (fileType === 'image' && !file.type.startsWith('image/')) {
    return c.json({ error: 'Invalid image file type' }, HttpStatusCodes.BAD_REQUEST)
  }

  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const fileName = `${fileType}_${timestamp}_${sanitizedName}`

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const fileBuffer = Buffer.from(yield* Effect.promise(() => file?.arrayBuffer()))
    const key = yield* s3Service.uploadFile(
      fileName,
      fileBuffer,
      file?.type,
      config.buckets.userContent
    )
    return { url: `${config.urls.router}/user-content/${key}`, key }
  }).pipe(
    Effect.withSpan('api.upload.file', { attributes: { fileType, fileName } }),
    Effect.tapError((e) =>
      Effect.logError('[Upload] File upload error', {
        fileName,
        fileType,
        fileSize: file?.size,
        error: (e as { message?: string }).message ?? String(e)
      })
    )
  )

  return runEffect<UploadFileRoute>(c, program)
}
