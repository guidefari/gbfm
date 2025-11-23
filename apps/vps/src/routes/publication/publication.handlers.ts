import { count, eq } from 'drizzle-orm'
import * as HttpStatusCodes from 'stoker/http-status-codes'
import { db } from '@/db'
import { publicationsTable } from '@/db/publication.schema'
import { createPaginationMetadata } from '@/lib/pagination'
import type { AppRouteHandler } from '@/lib/types'

import type {
  CreateRoute,
  GetOneRoute,
  ListRoute,
  PatchRoute,
  RemoveRoute
} from './publication.routes'

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { limit, offset } = c.req.valid('query')

  // Get total count
  const countResult = await db
    .select({ total: count() })
    .from(publicationsTable)

  const total = countResult[0]?.total ?? 0

  // Get paginated data (order by name since createdAt doesn't exist)
  const data = await db
    .select()
    .from(publicationsTable)
    .limit(limit)
    .offset(offset)
    .orderBy(publicationsTable.name)

  return c.json(
    {
      data,
      pagination: createPaginationMetadata(total, limit, offset)
    },
    HttpStatusCodes.OK
  )
}

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const publication = await db
    .select()
    .from(publicationsTable)
    .where(eq(publicationsTable.id, id))

  if (!publication.length) {
    return c.json({ error: 'Publication not found' }, HttpStatusCodes.NOT_FOUND)
  }

  return c.json(publication[0], HttpStatusCodes.OK)
}

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const validated = c.req.valid('json')

  const newPublication = await db
    .insert(publicationsTable)
    .values(validated)
    .returning()

  return c.json(newPublication[0], HttpStatusCodes.CREATED)
}

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const validated = c.req.valid('json')

  const updated = await db
    .update(publicationsTable)
    .set(validated)
    .where(eq(publicationsTable.id, id))
    .returning()

  if (!updated.length) {
    return c.json({ error: 'Publication not found' }, HttpStatusCodes.NOT_FOUND)
  }

  return c.json(updated[0], HttpStatusCodes.OK)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid('param')
  const deleted = await db
    .delete(publicationsTable)
    .where(eq(publicationsTable.id, id))
    .returning()

  if (!deleted.length) {
    return c.json({ error: 'Publication not found' }, HttpStatusCodes.NOT_FOUND)
  }

  return c.json(deleted[0], HttpStatusCodes.OK)
}
