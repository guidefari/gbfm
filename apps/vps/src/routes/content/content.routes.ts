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
import {
  createPostSchema,
  selectMdxCompiledEditorialPostSchema,
  selectMdxCompiledMicroPostSchema,
  selectMdxCompiledPostSchema,
  selectPostSchema,
  updatePostSchema
} from '@/db/post.schema'
import { createPaginatedResponseSchema, paginationQuerySchema } from '@/lib/pagination'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'
import { playTrackRateLimiter } from '@/middlewares/rate-limiter'

const tags = ['Content']

// Use schemas from database

const postResponseSchema = selectPostSchema

// tagParamsSchema imported from database
const tagParamsSchema = z
  .object({
    tag: z.string().min(1).openapi({ description: 'Tag to filter by', example: 'javascript' })
  })
  .openapi('TagParams')

// Routes
export const getPosts = createRoute({
  path: '/posts',
  method: 'get',
  request: {
    query: paginationQuerySchema.extend({
      type: z.enum(['post', 'micro']).optional().openapi({ description: 'Filter by post type' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectMdxCompiledPostSchema),
      'Paginated list of posts'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch posts'
    )
  }
})

export const getPostBySlug = createRoute({
  path: '/posts/{slug}',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string().openapi({ description: 'Post slug' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMdxCompiledPostSchema, 'Single post'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Post not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch post'
    )
  }
})

export const getEditorialPosts = createRoute({
  path: '/posts/editorials',
  method: 'get',
  request: {
    query: paginationQuerySchema.extend({
      tag: z.string().optional().openapi({ description: 'Filter by tag' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectMdxCompiledEditorialPostSchema),
      'Paginated list of editorial posts'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch editorial posts'
    )
  }
})

export const getEditorialPostBySlug = createRoute({
  path: '/posts/editorials/{slug}',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string().openapi({ description: 'Post slug' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledEditorialPostSchema,
      'Single editorial post'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Editorial post not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch editorial post'
    )
  }
})

export const getMicroPosts = createRoute({
  path: '/posts/micro',
  method: 'get',
  request: {
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectMdxCompiledMicroPostSchema),
      'Paginated list of micro posts'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch micro posts'
    )
  }
})

export const getMicroPostBySlug = createRoute({
  path: '/posts/micro/{slug}',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string().openapi({ description: 'Post slug' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMdxCompiledMicroPostSchema, 'Single micro post'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Micro post not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch micro post'
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
    [HttpStatusCodes.CREATED]: jsonContent(postResponseSchema, 'The created post'),
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
      z.object({ error: z.string() }),
      'Validation error'
    )
  }
})

export const updatePostBySlug = createRoute({
  path: '/posts/{slug}',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      slug: z.string().openapi({ description: 'Post slug' })
    }),
    body: jsonContentRequired(
      updatePostSchema.extend({
        creatorIds: z
          .array(z.string())
          .min(1)
          .optional()
          .openapi({ description: 'IDs of post creators' })
      }),
      'The post data to update'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMdxCompiledPostSchema, 'Updated post'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Post not found'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to edit this content'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ error: z.string() }), 'Forbidden.'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update post'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      z.object({ error: z.string() }),
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
    [HttpStatusCodes.OK]: jsonContent(z.object({ message: z.string() }), 'Seed endpoint status')
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
    [HttpStatusCodes.CREATED]: jsonContent(selectAudioSchema, 'The created audio'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
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

export const getAudioTags = createRoute({
  path: '/audio/{type}/tags',
  method: 'get',
  request: {
    params: z.object({ type: z.enum(['mix', 'track', 'misc']) })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.array(z.string()),
      'Unique tags for audio of the given type'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch tags'
    )
  }
})

export const getEditorialTags = createRoute({
  path: '/posts/editorials/tags',
  method: 'get',
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(z.array(z.string()), 'Unique tags for editorial posts'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch tags'
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
    [HttpStatusCodes.OK]: jsonContent(selectMdxCompiledAudioSchema, 'Single audio item'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Audio not found'),
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
    body: jsonContentRequired(updateAudioSchema.omit({ type: true }), 'The audio data to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(selectMdxCompiledAudioSchema, 'Updated audio item'),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Audio not found'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to edit this content'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ error: z.string() }), 'Forbidden.'),
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
    [HttpStatusCodes.CREATED]: jsonContent(selectAudioSchema, 'The created audio'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
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

export const trackAudioPlay = createRoute({
  path: '/audio/:id/play',
  method: 'post',
  middleware: [playTrackRateLimiter()],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ description: 'Audio ID' })
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        playCount: z.number().int().openapi({ description: 'Updated play count' })
      }),
      'Play tracked successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Audio not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to track play'
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
      force: z
        .string()
        .optional()
        .transform((v) => v === 'true')
        .openapi({ description: 'Skip cache and regenerate' })
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
    [HttpStatusCodes.NOT_FOUND]: jsonContent(z.object({ error: z.string() }), 'Mix not found'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to generate QR PDF'
    )
  }
})

// Export types
export type GetAudioTagsRoute = typeof getAudioTags
export type GetEditorialTagsRoute = typeof getEditorialTags
export type GetPostsRoute = typeof getPosts
export type GetPostBySlugRoute = typeof getPostBySlug
export type GetEditorialPostsRoute = typeof getEditorialPosts
export type GetEditorialPostBySlugRoute = typeof getEditorialPostBySlug
export type GetMicroPostsRoute = typeof getMicroPosts
export type GetMicroPostBySlugRoute = typeof getMicroPostBySlug
export type CreatePostRoute = typeof createPost
export type UpdatePostBySlugRoute = typeof updatePostBySlug
export type GetPostsByTagRoute = typeof getPostsByTag
export type SeedMixesRoute = typeof seedMixes
export type CreateMixRoute = typeof createMix
export type GetAudioByTypeRoute = typeof getAudioByType
export type GetAudioBySlugRoute = typeof getAudioBySlug
export type UpdateAudioBySlugRoute = typeof updateAudioBySlug
export type CreateAudioRoute = typeof createAudio
export type GetMixQRPdfRoute = typeof getMixQRPdf
export type TrackAudioPlayRoute = typeof trackAudioPlay
