import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Upload']

const partTag = z.object({
  partNumber: z.number().int().min(1).max(10000),
  etag: z.string().min(1)
})

const completedPartTag = z.object({
  partNumber: z.number().int().min(1).max(10000),
  etag: z.string().min(1),
  size: z.number().int().nonnegative()
})

export const initMultipart = createRoute({
  path: '/multipart/init',
  method: 'post',
  middleware: [betterAuthMiddleware],
  tags,
  request: {
    body: jsonContentRequired(
      z.object({
        fileName: z.string().min(1).max(255),
        contentType: z.string().min(1).max(127),
        fileSize: z.number().int().positive(),
        fileType: z.literal('audio')
      }),
      'Multipart upload initialization'
    )
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        uploadId: z.string(),
        key: z.string(),
        chunkSize: z.number().int().positive()
      }),
      'Multipart upload initialized'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Invalid initialization request'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
    [HttpStatusCodes.REQUEST_TOO_LONG]: jsonContent(
      z.object({ error: z.string() }),
      'File too large'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to initialize multipart upload'
    )
  }
})

export const uploadPart = createRoute({
  path: '/multipart/part',
  method: 'post',
  middleware: [betterAuthMiddleware],
  tags,
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            key: z.string().min(1),
            uploadId: z.string().min(1),
            partNumber: z
              .string()
              .regex(/^[0-9]+$/)
              .transform((value) => Number.parseInt(value, 10))
              .refine((value) => value >= 1 && value <= 10000, {
                message: 'partNumber must be between 1 and 10000'
              }),
            chunk: z.any()
          })
        }
      }
    }
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1),
        size: z.number().int().nonnegative()
      }),
      'Part uploaded'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ error: z.string() }), 'Invalid part'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to upload part'
    )
  }
})

export const completeMultipart = createRoute({
  path: '/multipart/complete',
  method: 'post',
  middleware: [betterAuthMiddleware],
  tags,
  request: {
    body: jsonContentRequired(
      z.object({
        key: z.string().min(1),
        uploadId: z.string().min(1),
        parts: z.array(partTag).min(1).max(10000)
      }),
      'Multipart upload completion'
    )
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        url: z.string(),
        key: z.string()
      }),
      'Multipart upload completed'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(z.object({ error: z.string() }), 'Invalid request'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to complete multipart upload'
    )
  }
})

export const abortMultipart = createRoute({
  path: '/multipart/abort',
  method: 'post',
  middleware: [betterAuthMiddleware],
  tags,
  request: {
    body: jsonContentRequired(
      z.object({
        key: z.string().min(1),
        uploadId: z.string().min(1)
      }),
      'Abort multipart upload'
    )
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ ok: z.literal(true) }),
      'Multipart upload aborted'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to abort multipart upload'
    )
  }
})

export const multipartStatus = createRoute({
  path: '/multipart/status',
  method: 'get',
  middleware: [betterAuthMiddleware],
  tags,
  request: {
    query: z.object({
      key: z.string().min(1),
      uploadId: z.string().min(1)
    })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        parts: z.array(completedPartTag)
      }),
      'Multipart upload status'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch multipart status'
    )
  }
})

export type InitMultipartRoute = typeof initMultipart
export type UploadPartRoute = typeof uploadPart
export type CompleteMultipartRoute = typeof completeMultipart
export type AbortMultipartRoute = typeof abortMultipart
export type MultipartStatusRoute = typeof multipartStatus
