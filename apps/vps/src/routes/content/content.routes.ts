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
import { createPaginatedResponseSchema, paginationQuerySchema } from '@/lib/pagination'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'
import { playTrackRateLimiter } from '@/middlewares/rate-limiter'

const tags = ['Content']

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
export type SeedMixesRoute = typeof seedMixes
export type CreateMixRoute = typeof createMix
export type GetAudioByTypeRoute = typeof getAudioByType
export type GetAudioBySlugRoute = typeof getAudioBySlug
export type UpdateAudioBySlugRoute = typeof updateAudioBySlug
export type CreateAudioRoute = typeof createAudio
export type GetMixQRPdfRoute = typeof getMixQRPdf
export type TrackAudioPlayRoute = typeof trackAudioPlay
