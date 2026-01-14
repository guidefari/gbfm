import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import {
  createLabelSchema,
  selectLabelSchema,
  selectMdxCompiledLabelSchema,
  updateLabelSchema
} from '@/db/label.schema'
import {
  createPaginatedResponseSchema,
  paginationQuerySchema
} from '@/lib/pagination'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Labels']

export const createLabel = createRoute({
  path: '/labels',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(createLabelSchema, 'The label to create')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectLabelSchema,
      'The created label'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Label with this slug already exists or invalid creator id'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create label'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createLabelSchema),
      'Validation error'
    )
  }
})

export const getAllLabels = createRoute({
  path: '/labels',
  method: 'get',
  request: {
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectLabelSchema),
      'Paginated list of labels'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch labels'
    )
  }
})

export const getLabelBySlug = createRoute({
  path: '/labels/{slug}',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledLabelSchema,
      'Single label'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Label not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch label'
    )
  }
})

export const updateLabelBySlug = createRoute({
  path: '/labels/{slug}',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      slug: z.string()
    }),
    body: jsonContentRequired(updateLabelSchema, 'The label data to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledLabelSchema,
      'Updated label'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Label not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to edit this content'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update label'
    )
  }
})

export type CreateLabelRoute = typeof createLabel
export type GetAllLabelsRoute = typeof getAllLabels
export type GetLabelBySlugRoute = typeof getLabelBySlug
export type UpdateLabelBySlugRoute = typeof updateLabelBySlug
