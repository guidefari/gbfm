import { createRoute, z } from '@hono/zod-openapi'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers'
import {
  favoriteWithAudioSchema,
  insertFavoriteSchema
} from '@/db/favorites.schema'
import { betterAuthMiddleware } from '@/middlewares/better-auth.middleware'

const tags = ['Favorites']

export const getFavoritesResponseSchema = z.object({
  success: z.boolean(),
  favorites: z.array(favoriteWithAudioSchema),
  total: z.number()
})

export const addFavoriteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

export const removeFavoriteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

export const addFavorite = createRoute({
  path: '/',
  method: 'post',
  middleware: [betterAuthMiddleware],
  request: {
    body: jsonContentRequired(insertFavoriteSchema, 'Audio to favorite')
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      addFavoriteResponseSchema,
      'Favorite added successfully'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Authentication required'
    ),
    [HttpStatusCodes.CONFLICT]: jsonContent(
      z.object({ error: z.string() }),
      'Already favorited'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Audio not found'
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
      removeFavoriteResponseSchema,
      'Favorite removed successfully'
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      z.object({ error: z.string() }),
      'Favorite not found'
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      'Authentication required'
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
      z.object({ error: z.string() }),
      'Authentication required'
    )
  },
  tags
})

export type AddFavoriteRoute = typeof addFavorite
export type RemoveFavoriteRoute = typeof removeFavorite
export type GetFavoritesRoute = typeof getFavorites
