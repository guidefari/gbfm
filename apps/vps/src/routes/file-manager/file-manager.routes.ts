import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { requireAdminMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['FileManager']

const s3ObjectSchema = z.object({
  key: z.string(),
  lastModified: z.string(),
  size: z.number()
})

export const getConfig = createRoute({
  path: '/config',
  method: 'get',
  middleware: [requireAdminMiddleware],
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        stage: z.string(),
        buckets: z.object({
          userContent: z.string(),
          mixes: z.string()
        })
      }),
      'Current stage and known bucket names'
    )
  }
})

export const listObjects = createRoute({
  path: '/list',
  method: 'get',
  middleware: [requireAdminMiddleware],
  tags,
  request: {
    query: z.object({
      bucketName: z.string().min(1),
      prefix: z.string().optional()
    })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        objects: z.array(s3ObjectSchema)
      }),
      'List of objects in the bucket'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Bad request'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to list objects'
    )
  }
})

export const copyObject = createRoute({
  path: '/copy',
  method: 'post',
  middleware: [requireAdminMiddleware],
  tags,
  request: {
    body: jsonContentRequired(
      z.object({
        key: z.string().min(1),
        sourceBucket: z.string().min(1),
        destinationBucket: z.string().min(1)
      }),
      'Copy object between buckets'
    )
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ key: z.string() }),
      'Object copied successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Bad request'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to copy object'
    )
  }
})

export type GetConfigRoute = typeof getConfig
export type ListObjectsRoute = typeof listObjects
export type CopyObjectRoute = typeof copyObject
