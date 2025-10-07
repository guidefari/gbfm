import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent } from 'stoker/openapi/helpers'

const tags = ['Upload']

export const uploadFile = createRoute({
  path: '/file',
  method: 'post',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            audioFile: z.any().optional(),
            imageFile: z.any().optional(),
            fileType: z.enum(['audio', 'image'])
          })
        }
      }
    }
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        url: z.string(),
        key: z.string()
      }),
      'File uploaded successfully'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Upload error'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to upload file'
    )
  }
})

export type UploadFileRoute = typeof uploadFile
