import { and, eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { audioTable } from '@/db/audio.schema'
import { favoritesTable } from '@/db/favorites.schema'
import type { AppRouteHandler } from '@/lib/types'

import type {
  AddFavoriteRoute,
  GetFavoritesRoute,
  RemoveFavoriteRoute
} from './favorites.routes'

export const addFavorite: AppRouteHandler<AddFavoriteRoute> = async (c) => {
  const user = c.get('user')
  const { audioId } = c.req.valid('json')

  const [audio] = await db
    .select()
    .from(audioTable)
    .where(eq(audioTable.id, audioId))
    .limit(1)

  if (!audio) {
    return c.json({ error: 'Audio not found' }, HttpStatusCodes.NOT_FOUND)
  }

  const [existing] = await db
    .select()
    .from(favoritesTable)
    .where(
      and(
        eq(favoritesTable.userId, user.id),
        eq(favoritesTable.audioId, audioId)
      )
    )
    .limit(1)

  if (existing) {
    return c.json({ error: 'Already favorited' }, HttpStatusCodes.CONFLICT)
  }

  await db.insert(favoritesTable).values({
    userId: user.id,
    audioId
  })

  return c.json(
    { success: true, message: 'Added to favorites' },
    HttpStatusCodes.CREATED
  )
}

// @ts-expect-error - OpenAPI type system creates strict union types that don't match Hono's flexible return types
export const removeFavorite: AppRouteHandler<RemoveFavoriteRoute> = async (
  c
) => {
  const user = c.get('user')
  const { audioId } = c.req.valid('param')

  const [existing] = await db
    .select()
    .from(favoritesTable)
    .where(
      and(
        eq(favoritesTable.userId, user.id),
        eq(favoritesTable.audioId, audioId)
      )
    )
    .limit(1)

  if (!existing) {
    return c.json({ error: 'Favorite not found' }, HttpStatusCodes.NOT_FOUND)
  }

  await db
    .delete(favoritesTable)
    .where(
      and(
        eq(favoritesTable.userId, user.id),
        eq(favoritesTable.audioId, audioId)
      )
    )

  return c.json({ success: true, message: 'Removed from favorites' })
}

// @ts-expect-error - OpenAPI type system creates strict union types that don't match Hono's flexible return types
export const getFavorites: AppRouteHandler<GetFavoritesRoute> = async (c) => {
  const user = c.get('user')
  const { limit, offset } = c.req.valid('query')

  const favorites = await db
    .select({
      id: favoritesTable.id,
      userId: favoritesTable.userId,
      audioId: favoritesTable.audioId,
      createdAt: favoritesTable.createdAt,
      audio: {
        id: audioTable.id,
        title: audioTable.title,
        slug: audioTable.slug,
        thumbnailUrl: audioTable.thumbnailUrl,
        type: audioTable.type,
        url: audioTable.url
      }
    })
    .from(favoritesTable)
    .innerJoin(audioTable, eq(favoritesTable.audioId, audioTable.id))
    .where(eq(favoritesTable.userId, user.id))
    .orderBy(favoritesTable.createdAt)
    .limit(limit)
    .offset(offset)

  const formattedFavorites = favorites.map((fav) => ({
    ...fav,
    createdAt: fav.createdAt.toISOString()
  }))

  return c.json({
    success: true,
    favorites: formattedFavorites,
    total: favorites.length
  })
}
