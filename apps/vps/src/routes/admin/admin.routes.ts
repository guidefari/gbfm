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
    [HttpStatusCodes.OK]: jsonContent(adminOverviewResponseSchema, 'Admin overview dashboard data'),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ error: z.string() }), 'Forbidden'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch admin overview'
    )
  }
})

export const simulateFrontendError = createRoute({
  path: '/frontend-errors/{scenario}',
  method: 'get',
  middleware: [requireAdminMiddleware],
  tags,
  request: {
    params: z.object({
      scenario: z.enum(['ok', 'bad-request', 'not-found', 'rate-limit', 'error', 'unavailable'])
    })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({ scenario: z.string(), message: z.string() }),
      'Successful frontend error simulator response'
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      z.object({ error: z.string(), scenario: z.string() }),
      'Simulated bad request'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string(), scenario: z.string() }),
      'Simulated not found'
    ),
    [HttpStatusCodes.TOO_MANY_REQUESTS]: jsonContent(
      z.object({ error: z.string(), scenario: z.string() }),
      'Simulated rate limit'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string(), scenario: z.string() }),
      'Simulated server error'
    ),
    [HttpStatusCodes.SERVICE_UNAVAILABLE]: jsonContent(
      z.object({ error: z.string(), scenario: z.string() }),
      'Simulated service unavailable'
    )
  }
})

export const getNewsletterSubscribers = createRoute({
  path: '/newsletter-subscribers',
  method: 'get',
  middleware: [requireAdminMiddleware],
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        subscribers: z.array(
          z.object({
            id: z.string(),
            email: z.string(),
            name: z.string().nullable(),
            source: z.string().nullable(),
            unsubscribedAt: z.string().nullable(),
            createdAt: z.string()
          })
        )
      }),
      'Newsletter subscribers list'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(z.object({ error: z.string() }), 'Unauthorized'),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(z.object({ error: z.string() }), 'Forbidden')
  }
})

export type GetAdminOverviewRoute = typeof getAdminOverview
export type SimulateFrontendErrorRoute = typeof simulateFrontendError
export type GetNewsletterSubscribersRoute = typeof getNewsletterSubscribers
