import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import {
  favoriteWithAudioSchema,
  insertFavoriteSchema
} from '@/db/favorites.schema'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Favorites']

export const getFavoritesResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    favorites: z.array(favoriteWithAudioSchema),
    total: z.number()
  }),
  z.object({
    error: z.string()
  })
])

export const favoriteResponseSchema = z.union([
  z.object({
    success: z.boolean(),
    message: z.string()
  }),
  z.object({
    error: z.string()
  })
])

export const addFavorite = createRoute({
  path: '/',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(insertFavoriteSchema, 'Audio to favorite')
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      favoriteResponseSchema,
      'Favorite added successfully'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      favoriteResponseSchema,
      'Authentication required'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      favoriteResponseSchema,
      'Already favorited'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      favoriteResponseSchema,
      'Audio not found'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      favoriteResponseSchema,
      'Internal server error'
    )
  },
  tags
})

export const removeFavorite = createRoute({
  path: '/:audioId',
  method: 'delete',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({ audioId: z.string().uuid() })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      favoriteResponseSchema,
      'Favorite removed successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      favoriteResponseSchema,
      'Favorite not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      favoriteResponseSchema,
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      favoriteResponseSchema,
      'Internal server error'
    )
  },
  tags
})

export const getFavorites = createRoute({
  path: '/',
  method: 'get',
  middleware: [betterAuthMiddleware],
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).optional().default(20),
      offset: z.coerce.number().min(0).optional().default(0)
    })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      getFavoritesResponseSchema,
      'Favorites retrieved successfully'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      getFavoritesResponseSchema,
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      getFavoritesResponseSchema,
      'Internal server error'
    )
  },
  tags
})

export const removeShowFavorite = createRoute({
  path: '/show/:showId',
  method: 'delete',
  middleware: [betterAuthMiddleware],
  request: {
    params: z.object({ showId: z.string().uuid() })
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      favoriteResponseSchema,
      'Show favorite removed successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      favoriteResponseSchema,
      'Favorite not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      favoriteResponseSchema,
      'Authentication required'
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      favoriteResponseSchema,
      'Internal server error'
    )
  },
  tags
})

export type AddFavoriteRoute = typeof addFavorite
export type RemoveFavoriteRoute = typeof removeFavorite
export type RemoveShowFavoriteRoute = typeof removeShowFavorite
export type GetFavoritesRoute = typeof getFavorites
