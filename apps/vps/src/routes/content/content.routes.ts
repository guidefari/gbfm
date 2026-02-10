import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import {
  createAudioSchema,
  selectAudioSchema,
  selectMdxCompiledAudioSchema,
  updateAudioSchema
} from '@/db/audio.schema'
import { createPostSchema, selectPostSchema } from '@/db/post.schema'
import {
  createPaginatedResponseSchema,
  paginationQuerySchema
} from '@/lib/pagination'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Content']

// Use schemas from database

const postResponseSchema = selectPostSchema

// tagParamsSchema imported from database
const tagParamsSchema = z
  .object({
    tag: z
      .string()
      .min(1)
      .openapi({ description: 'Tag to filter by', example: 'javascript' })
  })
  .openapi('TagParams')

// Routes
export const getPosts = createRoute({
  path: '/posts',
  method: 'get',
  request: {
    query: paginationQuerySchema.extend({
      type: z
        .enum(['post', 'micro'])
        .optional()
        .openapi({ description: 'Filter by post type' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(postResponseSchema),
      'Paginated list of posts'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch posts'
    )
  }
})

export const createPost = createRoute({
  path: '/post',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(createPostSchema, 'The post to create')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      postResponseSchema,
      'The created post'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z
        .object({ error: z.string().openapi({ description: 'Error message' }) })
        .openapi('ErrorResponse'),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z
        .object({ error: z.string().openapi({ description: 'Error message' }) })
        .openapi('ErrorResponse'),
      'Failed to create post'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createPostSchema),
      'Validation error'
    )
  }
})

export const getPostsByTag = createRoute({
  path: '/tag/{tag}',
  method: 'get',
  request: {
    params: tagParamsSchema,
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(postResponseSchema),
      'Paginated posts filtered by tag'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch posts'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(tagParamsSchema),
      'Invalid tag parameter'
    )
  }
})

export const seedMixes = createRoute({
  path: '/seed-mixes',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      'Seed endpoint status'
    )
  }
})

export const createMix = createRoute({
  path: '/mixes',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(createAudioSchema, 'The audio to create')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectAudioSchema,
      'The created audio'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Mix with this slug already exists or invalid creator id'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create mix'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createAudioSchema),
      'Validation error'
    )
  }
})

export const processMixUpload = createRoute({
  path: '/mixes/process',
  method: 'post',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            title: z.string(),
            artist: z.string().optional(),
            album: z.string().optional(),
            description: z.string(),
            outputFormat: z.enum(['mp3', 'mp4']),
            audioFile: z.any(),
            coverImage: z.any()
          })
        }
      }
    }
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: {
      content: {
        'audio/mpeg': {
          schema: z.string().openapi({ format: 'binary' })
        },
        'video/mp4': {
          schema: z.string().openapi({ format: 'binary' })
        }
      },
      description: 'Processed audio/video file'
    },
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string() }),
      'Processing error'
    ),
    [HttpStatusCodes.REQUEST_TOO_LONG]: {
      content: {
        'text/plain': {
          schema: z.string()
        }
      },
      description: 'File too large'
    },
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to process upload'
    )
  }
})

export const getAudioByType = createRoute({
  path: '/audio/{type}',
  method: 'get',
  request: {
    params: z.object({ type: z.enum(['mix', 'track', 'misc']) }),
    query: paginationQuerySchema.extend({
      tag: z.string().optional()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectAudioSchema),
      'Paginated list of audio'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch audio'
    )
  }
})

export const getAudioBySlug = createRoute({
  path: '/audio/{type}/{slug}',
  method: 'get',
  request: {
    params: z.object({
      type: z.enum(['mix', 'track', 'misc']),
      slug: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledAudioSchema,
      'Single audio item'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Audio not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch audio'
    )
  }
})

export const updateAudioBySlug = createRoute({
  path: '/audio/{type}/{slug}',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      type: z.enum(['mix', 'track', 'misc']),
      slug: z.string()
    }),
    body: jsonContentRequired(
      updateAudioSchema.omit({ type: true }),
      'The audio data to update'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledAudioSchema,
      'Updated audio item'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Audio not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to edit this content'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Forbidden.'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update audio'
    )
  }
})

export const createAudio = createRoute({
  path: '/audio',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(createAudioSchema, 'The audio to create')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectAudioSchema,
      'The created audio'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Audio with this slug already exists or invalid creator id'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create audio'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createAudioSchema),
      'Validation error'
    )
  }
})

export const getMixQRPdf = createRoute({
  path: '/audio/mix/{slug}/qr-pdf',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string().openapi({ description: 'Mix slug' })
    }),
    query: z.object({
      template: z
        .enum(['flyer', 'qr'])
        .default('flyer')
        .openapi({ description: 'PDF template style' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        url: z.string().openapi({ description: 'URL to the generated PDF' }),
        cached: z.boolean().openapi({ description: 'Whether PDF was cached' })
      }),
      'QR PDF URL'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Mix not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to generate QR PDF'
    )
  }
})

// Export types
export type GetPostsRoute = typeof getPosts
export type CreatePostRoute = typeof createPost
export type GetPostsByTagRoute = typeof getPostsByTag
export type SeedMixesRoute = typeof seedMixes
export type CreateMixRoute = typeof createMix
export type ProcessMixUploadRoute = typeof processMixUpload
export type GetAudioByTypeRoute = typeof getAudioByType
export type GetAudioBySlugRoute = typeof getAudioBySlug
export type UpdateAudioBySlugRoute = typeof updateAudioBySlug
export type CreateAudioRoute = typeof createAudio
export type GetMixQRPdfRoute = typeof getMixQRPdf
