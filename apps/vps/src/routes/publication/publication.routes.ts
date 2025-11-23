import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'

import {
  createPublicationSchema,
  selectPublicationSchema,
  updatePublicationSchema
} from '@/db/publication.schema'
import {
  createPaginatedResponseSchema,
  paginationQuerySchema
} from '@/lib/pagination'

const tags = ['Publications']

// Use derived schema from database
const publicationResponseSchema = selectPublicationSchema

// UUID parameter schema for publications
const publicationParamsSchema = z.object({
  id: z.uuid()
})

// Routes
export const list = createRoute({
  path: '/',
  method: 'get',
  request: {
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(publicationResponseSchema),
      'Paginated list of publications'
    )
  }
})

export const getOne = createRoute({
  path: '/{id}',
  method: 'get',
  request: {
    params: publicationParamsSchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      publicationResponseSchema,
      'The requested publication'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Publication not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(publicationParamsSchema),
      'Invalid id error'
    )
  }
})

export const create = createRoute({
  path: '/',
  method: 'post',
  request: {
    body: jsonContentRequired(
      createPublicationSchema,
      'The publication to create'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      publicationResponseSchema,
      'The created publication'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createPublicationSchema),
      'Validation error'
    )
  }
})

export const patch = createRoute({
  path: '/{id}',
  method: 'patch',
  request: {
    params: publicationParamsSchema,
    body: jsonContentRequired(
      updatePublicationSchema,
      'The publication updates'
    )
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      publicationResponseSchema,
      'The updated publication'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Publication not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(updatePublicationSchema).or(
        createErrorSchema(publicationParamsSchema)
      ),
      'Validation error'
    )
  }
})

export const remove = createRoute({
  path: '/{id}',
  method: 'delete',
  request: {
    params: publicationParamsSchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      publicationResponseSchema,
      'The deleted publication'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Publication not found'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(publicationParamsSchema),
      'Invalid id error'
    )
  }
})

// Export types
export type ListRoute = typeof list
export type GetOneRoute = typeof getOne
export type CreateRoute = typeof create
export type PatchRoute = typeof patch
export type RemoveRoute = typeof remove
