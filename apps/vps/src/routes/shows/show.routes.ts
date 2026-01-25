import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import { createErrorSchema } from 'stoker/openapi/schemas'
import {
  createShowSchema,
  selectMdxCompiledShowSchema,
  selectShowSchema,
  selectSubscriptionSchema,
  subscriptionWithShowSchema,
  updateShowSchema
} from '@/db/show.schema'
import {
  createPaginatedResponseSchema,
  paginationQuerySchema
} from '@/lib/pagination'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'
import { selectAudioSchema } from '@/db/audio.schema'

const tags = ['Shows']

const showWithHostsSchema = selectShowSchema
  .extend({
    hosts: z
      .array(
        z.object({
          id: z.string(),
          name: z.string()
        })
      )
      .openapi({ description: 'List of hosts for this show' })
  })
  .openapi('ShowWithHosts')

export const getAllShows = createRoute({
  path: '/shows',
  method: 'get',
  request: {
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(showWithHostsSchema),
      'Paginated list of shows'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch shows'
    )
  }
})

export const getShowBySlug = createRoute({
  path: '/shows/{slug}',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledShowSchema,
      'Single show with compiled MDX'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Show not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch show'
    )
  }
})

export const createShow = createRoute({
  path: '/shows',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(createShowSchema, 'The show to create')
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectShowSchema,
      'The created show'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Show with this slug already exists or invalid host id'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to create show'
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(createShowSchema),
      'Validation error'
    )
  }
})

export const updateShowBySlug = createRoute({
  path: '/shows/{slug}',
  method: 'patch',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      slug: z.string()
    }),
    body: jsonContentRequired(updateShowSchema, 'The show data to update')
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      selectMdxCompiledShowSchema,
      'Updated show'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Show not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to edit this show'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to update show'
    )
  }
})

export const deleteShowBySlug = createRoute({
  path: '/shows/{slug}',
  method: 'delete',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      slug: z.string()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Show deleted successfully'
    },
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Show not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Not authorized to delete this show'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to delete show'
    )
  }
})

export const getShowEpisodes = createRoute({
  path: '/shows/{slug}/episodes',
  method: 'get',
  request: {
    params: z.object({
      slug: z.string()
    }),
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(selectAudioSchema),
      'Paginated list of episodes'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Show not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch episodes'
    )
  }
})

export const subscribeToShow = createRoute({
  path: '/shows/{id}/subscribe',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      selectSubscriptionSchema,
      'Subscription created'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Already subscribed or show not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to subscribe'
    )
  }
})

export const unsubscribeFromShow = createRoute({
  path: '/shows/{id}/unsubscribe',
  method: 'delete',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  tags,
  responses: {
    [HttpStatusCodes.NO_CONTENT]: {
      description: 'Unsubscribed successfully'
    },
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Subscription not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to unsubscribe'
    )
  }
})

export const getUserSubscriptions = createRoute({
  path: '/user/subscriptions',
  method: 'get',
  middleware: [betterAuthMiddleware],
  request: {
    query: paginationQuerySchema
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      createPaginatedResponseSchema(subscriptionWithShowSchema),
      'User subscriptions'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Unauthorized'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({ error: z.string() }),
      'Failed to fetch subscriptions'
    )
  }
})

export type GetAllShowsRoute = typeof getAllShows
export type GetShowBySlugRoute = typeof getShowBySlug
export type CreateShowRoute = typeof createShow
export type UpdateShowBySlugRoute = typeof updateShowBySlug
export type DeleteShowBySlugRoute = typeof deleteShowBySlug
export type GetShowEpisodesRoute = typeof getShowEpisodes
export type SubscribeToShowRoute = typeof subscribeToShow
export type UnsubscribeFromShowRoute = typeof unsubscribeFromShow
export type GetUserSubscriptionsRoute = typeof getUserSubscriptions
