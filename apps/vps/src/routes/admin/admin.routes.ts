import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent } from 'stoker/openapi/helpers'
import { adminOverviewResponseSchema } from '@/db/admin-overview.schema'
import { requireAdminMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Admin']

export const getAdminOverview = createRoute({
  path: '/overview',
  method: 'get',
  middleware: [requireAdminMiddleware],
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      adminOverviewResponseSchema,
      'Admin overview dashboard data'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(
      z.object({ error: z.string() }),
      'Forbidden'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch admin overview'
    )
  }
})

export type GetAdminOverviewRoute = typeof getAdminOverview
