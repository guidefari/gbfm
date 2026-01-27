import { Effect } from 'effect'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { S3Error } from '@/errors'
import type { AppRouteHandler } from '@/lib/types'
import { runApp } from '@/runtime'
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
      {
        error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
      },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  if (fileType === 'audio' && !file.type.startsWith('audio/')) {
    return c.json(
      { error: 'Invalid audio file type' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  if (fileType === 'image' && !file.type.startsWith('image/')) {
    return c.json(
      { error: 'Invalid image file type' },
      HttpStatusCodes.BAD_REQUEST
    )
  }

  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const fileName = `${fileType}_${timestamp}_${sanitizedName}`

  const program = Effect.gen(function* () {
    const config = yield* ConfigService
    const s3Service = yield* S3Service
    const fileBuffer = Buffer.from(
      yield* Effect.promise(() => file.arrayBuffer())
    )
    const bucketName = config.buckets.userContent

    const key = yield* s3Service.uploadFile(
      fileName,
      fileBuffer,
      file.type,
      bucketName
    )

    const publicUrl = `${config.urls.router}/user-content/${key}`
    return { url: publicUrl, key }
  })

  const result = await runApp(
    program.pipe(
      Effect.withSpan('api.upload.file', {
        attributes: { fileType, fileName }
      }),
      Effect.either
    )
  )

  if (result._tag === 'Left') {
    const error = result.left
    if (error instanceof S3Error) {
      Effect.logError('[Upload] File upload error', {
        fileName,
        fileType,
        fileSize: file.size,
        error: error.message
      }).pipe(Effect.runPromise)
    }
    return c.json(
      { error: 'Failed to upload file' },
      HttpStatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json(result.right, HttpStatusCodes.OK)
}
