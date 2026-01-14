import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import {
  createReleaseSchema,
  selectMdxCompiledReleaseSchema,
  selectReleaseSchema,
  updateReleaseSchema
} from '@/db/release.schema'
import {
  createPaginatedResponseSchema,
  paginationQuerySchema
} from '@/lib/pagination'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Releases']

export const createRelease = createRoute({
  path: '/releases',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(createReleaseSchema, 'The release to create')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectReleaseSchema,
      'The created release'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Release with this slug already exists'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Label not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create release'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createReleaseSchema),
      'Validation error'
    )
  }
})

export const getReleasesByLabel = createRoute({
  path: '/labels/{labelSlug}/releases',
  method: 'get',
  request: {
    params: z.object({
      labelSlug: z.string()
    }),
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectReleaseSchema),
      'Paginated list of releases for the label'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Label not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch releases'
    )
  }
})

export const getReleaseBySlug = createRoute({
  path: '/releases/{slug}',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledReleaseSchema,
      'Single release'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Release not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch release'
    )
  }
})

export const updateReleaseBySlug = createRoute({
  path: '/releases/{slug}',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      slug: z.string()
    }),
    body: jsonContentRequired(updateReleaseSchema, 'The release data to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledReleaseSchema,
      'Updated release'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Release not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to edit this content'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update release'
    )
  }
})

export const deleteReleaseBySlug = createRoute({
  path: '/releases/{slug}',
  method: 'delete',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      slug: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ message: z.string() }),
      'Release deleted successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Release not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to delete this content'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to delete release'
    )
  }
})

export type CreateReleaseRoute = typeof createRelease
export type GetReleasesByLabelRoute = typeof getReleasesByLabel
export type GetReleaseBySlugRoute = typeof getReleaseBySlug
export type UpdateReleaseBySlugRoute = typeof updateReleaseBySlug
export type DeleteReleaseBySlugRoute = typeof deleteReleaseBySlug
